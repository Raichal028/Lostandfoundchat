const Item = require('../models/Item');
const Claim = require('../models/Claim');

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value = '') => normalizeText(value).split(' ').filter(Boolean);

const levenshtein = (a = '', b = '') => {
  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
};

const similarityScore = (left = '', right = '') => {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (!a || !b) {
    return 0;
  }

  const tokenA = new Set(tokenize(a));
  const tokenB = new Set(tokenize(b));
  const shared = [...tokenA].filter((token) => tokenB.has(token)).length;
  const union = new Set([...tokenA, ...tokenB]).size || 1;
  const tokenScore = shared / union;

  const distance = levenshtein(a, b);
  const baseLength = Math.max(a.length, b.length) || 1;
  const editScore = 1 - distance / baseLength;

  return Number(((tokenScore * 0.65) + (Math.max(editScore, 0) * 0.35)).toFixed(3));
};

const calculateMatchScore = (item, candidate) => {
  const title = similarityScore(item.title, candidate.title);
  const category = normalizeText(item.category) === normalizeText(candidate.category) ? 1 : 0;
  const location = similarityScore(item.location, candidate.location);
  return Number(((title * 0.55) + (category * 0.25) + (location * 0.2)).toFixed(3));
};

const getMatchedItems = async (item) => {
  const oppositeType = item.type === 'lost' ? 'found' : 'lost';
  const candidates = await Item.find({
    type: oppositeType,
    status: 'open',
    _id: { $ne: item._id }
  })
    .populate('postedBy', 'name email profileImage')
    .sort({ createdAt: -1 })
    .limit(20);

  return candidates
    .map((candidate) => ({
      ...candidate.toObject(),
      matchScore: calculateMatchScore(item, candidate)
    }))
    .filter((candidate) => candidate.matchScore >= 0.3)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
};

const validateItemPayload = (payload) => {
  const required = ['type', 'title', 'description', 'category', 'location'];
  const missing = required.filter((key) => !payload[key]);

  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  if (!['lost', 'found'].includes(payload.type)) {
    return 'Item type must be either lost or found';
  }

  if (payload.type === 'lost' && !payload.dateLost) {
    return 'dateLost is required for lost items';
  }

  if (payload.type === 'found' && !payload.dateFound) {
    return 'dateFound is required for found items';
  }

  return null;
};

const buildItemPayload = (body, filePath) => ({
  type: body.type,
  title: body.title?.trim(),
  description: body.description?.trim(),
  category: body.category?.trim(),
  location: body.location?.trim(),
  dateLost: body.dateLost || undefined,
  dateFound: body.dateFound || undefined,
  reward: body.reward?.trim() || '',
  image: filePath || body.image || '',
  status: body.status || 'open'
});

const buildItemQuery = (req) => {
  const { type, category, location, status, mine } = req.query;
  const query = {};

  if (type) {
    query.type = type;
  }

  if (category) {
    query.category = new RegExp(category, 'i');
  }

  if (location) {
    query.location = new RegExp(location, 'i');
  }

  if (status) {
    query.status = status;
  }

  if (mine === 'true' && req.user) {
    query.postedBy = req.user._id;
  }

  return query;
};

const createItem = async (req, res) => {
  try {
    const imagePath = req.file ? `/uploads/items/${req.file.filename}` : '';
    const payload = buildItemPayload(req.body, imagePath);
    const validationError = validateItemPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const item = await Item.create({
      ...payload,
      postedBy: req.user._id
    });

    const populatedItem = await Item.findById(item._id).populate('postedBy', 'name email profileImage');
    const matches = await getMatchedItems(populatedItem);

    res.status(201).json({
      item: populatedItem,
      matches
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not create item', error: error.message });
  }
};

const getItems = async (req, res) => {
  try {
    const { q = '', sort = 'latest', page = 1, limit = 8 } = req.query;
    const query = buildItemQuery(req);
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 8, 1), 50);

    if (q) {
      const candidates = await Item.find(query)
        .populate('postedBy', 'name email profileImage')
        .sort({ createdAt: -1 })
        .limit(120);

      const ranked = candidates
        .map((item) => ({
          ...item.toObject(),
          searchScore: similarityScore(q, item.title)
        }))
        .filter((item) => item.searchScore >= 0.1)
        .sort((a, b) => {
          if (sort === 'oldest') {
            return new Date(a.createdAt) - new Date(b.createdAt);
          }

          if (b.searchScore === a.searchScore) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }

          return b.searchScore - a.searchScore;
        });

      const total = ranked.length;
      const items = ranked.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

      return res.json({
        items,
        pagination: {
          page: pageNumber,
          pages: Math.max(Math.ceil(total / pageSize), 1),
          total
        }
      });
    }

    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    const total = await Item.countDocuments(query);
    const items = await Item.find(query)
      .populate('postedBy', 'name email profileImage')
      .sort(sortOption)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.json({
      items,
      pagination: {
        page: pageNumber,
        pages: Math.max(Math.ceil(total / pageSize), 1),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch items', error: error.message });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('postedBy', 'name email profileImage createdAt');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const matches = await getMatchedItems(item);
    const claims = req.user && String(item.postedBy._id) === String(req.user._id)
      ? await Claim.find({ itemId: item._id })
          .populate('claimer', 'name email profileImage')
          .sort({ createdAt: -1 })
      : [];

    res.json({ item, matches, claims });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch item', error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const existingItem = await Item.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const isOwner = String(existingItem.postedBy) === String(req.user._id);

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot update this item' });
    }

    const imagePath = req.file ? `/uploads/items/${req.file.filename}` : existingItem.image;
    const payload = buildItemPayload(
      { ...existingItem.toObject(), ...req.body, type: req.body.type || existingItem.type },
      imagePath
    );
    const validationError = validateItemPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    Object.assign(existingItem, payload);
    await existingItem.save();

    const updatedItem = await Item.findById(existingItem._id).populate('postedBy', 'name email profileImage');
    const matches = await getMatchedItems(updatedItem);

    res.json({ item: updatedItem, matches });
  } catch (error) {
    res.status(500).json({ message: 'Could not update item', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const isOwner = String(item.postedBy) === String(req.user._id);

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot delete this item' });
    }

    await Claim.deleteMany({ itemId: item._id });
    await item.deleteOne();

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete item', error: error.message });
  }
};

const createClaim = async (req, res) => {
  try {
    const { itemId, message } = req.body;

    if (!itemId || !message) {
      return res.status(400).json({ message: 'itemId and message are required' });
    }

    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (String(item.postedBy) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot claim your own item' });
    }

    const duplicateClaim = await Claim.findOne({
      itemId,
      claimer: req.user._id,
      status: 'pending'
    });

    if (duplicateClaim) {
      return res.status(409).json({ message: 'You already have a pending claim for this item' });
    }

    const claim = await Claim.create({
      itemId,
      claimer: req.user._id,
      message: message.trim()
    });

    const populatedClaim = await Claim.findById(claim._id)
      .populate('claimer', 'name email profileImage')
      .populate('itemId');

    const io = req.app.get('io');
    io.to(`user:${item.postedBy}`).emit('notification', {
      type: 'claim',
      title: 'New ownership claim',
      message: `${req.user.name} thinks item "${item.title}" belongs to them.`,
      itemId: item._id
    });

    res.status(201).json({ claim: populatedClaim });
  } catch (error) {
    res.status(500).json({ message: 'Could not create claim', error: error.message });
  }
};

const getClaims = async (req, res) => {
  try {
    const incoming = await Claim.find()
      .populate({
        path: 'itemId',
        populate: {
          path: 'postedBy',
          select: 'name email profileImage'
        }
      })
      .populate('claimer', 'name email profileImage')
      .sort({ createdAt: -1 });

    const filteredIncoming = incoming.filter(
      (claim) =>
        claim.itemId &&
        String(claim.itemId.postedBy._id || claim.itemId.postedBy) === String(req.user._id)
    );

    const outgoing = await Claim.find({ claimer: req.user._id })
      .populate({
        path: 'itemId',
        populate: {
          path: 'postedBy',
          select: 'name email profileImage'
        }
      })
      .populate('claimer', 'name email profileImage')
      .sort({ createdAt: -1 });

    res.json({ incoming: filteredIncoming, outgoing });
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch claims', error: error.message });
  }
};

const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Claim status must be accepted or rejected' });
    }

    const claim = await Claim.findById(req.params.id).populate('itemId').populate('claimer', 'name');

    if (!claim || !claim.itemId) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    const isOwner = String(claim.itemId.postedBy) === String(req.user._id);

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot update this claim' });
    }

    claim.status = status;
    await claim.save();

    if (status === 'accepted') {
      claim.itemId.status = 'resolved';
      await claim.itemId.save();
    }

    const io = req.app.get('io');
    io.to(`user:${claim.claimer._id}`).emit('notification', {
      type: 'claim-status',
      title: 'Claim updated',
      message: `Your claim for "${claim.itemId.title}" was ${status}.`,
      itemId: claim.itemId._id
    });

    res.json({ claim });
  } catch (error) {
    res.status(500).json({ message: 'Could not update claim', error: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  createClaim,
  getClaims,
  updateClaimStatus
};
