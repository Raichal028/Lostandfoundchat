import {
  attachImagePreview,
  createSkeletonCards,
  escapeHtml,
  formatDate,
  makeAvatar,
  request,
  showToast
} from '/js/api.js';
import { requireAuth } from '/js/auth.js';
import { ChatManager } from '/js/chat.js';

const itemCard = (item) => `
  <article class="mini-card fade-in">
    <div class="mini-card-head">
      <span class="badge badge-${item.type === 'lost' ? 'warn' : 'accent'}">${item.type}</span>
      <span class="badge">${item.status}</span>
    </div>
    <h4>${escapeHtml(item.title)}</h4>
    <p>${escapeHtml(item.location)}</p>
    <small>${formatDate(item.createdAt)}</small>
    <div class="inline-actions">
      <button class="btn btn-ghost" type="button" data-resolve-item="${item._id}">Resolve</button>
      <button class="btn btn-danger" type="button" data-delete-item="${item._id}">Delete</button>
    </div>
  </article>
`;

const claimCard = (claim, incoming = false) => `
  <article class="mini-card fade-in">
    <div class="mini-card-head">
      <span class="badge badge-${claim.status === 'accepted' ? 'success' : claim.status === 'rejected' ? 'danger' : 'warn'}">
        ${escapeHtml(claim.status)}
      </span>
      <span class="badge">${escapeHtml(claim.itemId?.title || 'Item')}</span>
    </div>
    <p>${escapeHtml(claim.message)}</p>
    <div class="user-inline">
      <div class="avatar small">${makeAvatar(incoming ? claim.claimer : claim.itemId?.postedBy || {})}</div>
      <span>${escapeHtml(incoming ? claim.claimer?.name || 'Unknown' : claim.itemId?.postedBy?.name || 'Unknown')}</span>
    </div>
    ${
      incoming && claim.status === 'pending'
        ? `
          <div class="inline-actions">
            <button class="btn btn-primary" type="button" data-claim-action="${claim._id}:accepted">Accept</button>
            <button class="btn btn-ghost" type="button" data-claim-action="${claim._id}:rejected">Reject</button>
          </div>
        `
        : ''
    }
  </article>
`;

const renderMatches = (matches = []) => {
  const holder = document.querySelector('#match-suggestions');

  if (!holder) {
    return;
  }

  holder.innerHTML = matches.length
    ? matches
        .map(
          (item) => `
            <a class="suggestion-chip" href="/item?id=${item._id}">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${Math.round(item.matchScore * 100)}% match</span>
            </a>
          `
        )
        .join('')
    : '<div class="empty-state compact">No smart matches yet.</div>';
};

const loadMyItems = async (type, containerId) => {
  const container = document.querySelector(containerId);
  createSkeletonCards(container, 2);

  const { items } = await request(`/items?mine=true&type=${type}&limit=12`);
  container.innerHTML = items.length
    ? items.map(itemCard).join('')
    : `<div class="empty-state compact">No ${type} items yet.</div>`;
};

const loadClaims = async () => {
  const incomingNode = document.querySelector('#incoming-claims');
  const outgoingNode = document.querySelector('#outgoing-claims');
  incomingNode.innerHTML = '<div class="skeleton skeleton-line"></div>';
  outgoingNode.innerHTML = '<div class="skeleton skeleton-line"></div>';

  const { incoming, outgoing } = await request('/claims');

  incomingNode.innerHTML = incoming.length
    ? incoming.map((claim) => claimCard(claim, true)).join('')
    : '<div class="empty-state compact">No incoming claims.</div>';

  outgoingNode.innerHTML = outgoing.length
    ? outgoing.map((claim) => claimCard(claim)).join('')
    : '<div class="empty-state compact">No outgoing claims.</div>';
};

const setDateMode = () => {
  const typeField = document.querySelector('#item-type');
  const rewardField = document.querySelector('[data-reward-wrap]');
  const dateLabel = document.querySelector('[data-date-label]');

  if (!typeField) {
    return;
  }

  const sync = () => {
    const lost = typeField.value === 'lost';
    rewardField.hidden = !lost;
    dateLabel.textContent = lost ? 'Date Lost' : 'Date Found';
  };

  typeField.addEventListener('change', sync);
  sync();
};

const setupItemComposer = async () => {
  const form = document.querySelector('#item-form');

  if (!form) {
    return;
  }

  attachImagePreview(document.querySelector('#item-image'), document.querySelector('#item-preview'));
  setDateMode();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = new FormData(form);
    const type = body.get('type');
    const dateValue = body.get('itemDate');

    body.append(type === 'lost' ? 'dateLost' : 'dateFound', dateValue);
    body.delete('itemDate');

    try {
      const { matches } = await request('/items', {
        method: 'POST',
        body
      });

      showToast('Item posted successfully.', 'success');
      form.reset();
      document.querySelector('#item-preview').src = '/placeholder.svg';
      document.querySelector('#item-type').dispatchEvent(new Event('change'));
      renderMatches(matches);
      await Promise.all([loadMyItems('lost', '#my-lost-items'), loadMyItems('found', '#my-found-items')]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

const setupActions = () => {
  document.addEventListener('click', async (event) => {
    const resolveButton = event.target.closest('[data-resolve-item]');
    const deleteButton = event.target.closest('[data-delete-item]');
    const claimButton = event.target.closest('[data-claim-action]');

    try {
      if (resolveButton) {
        await request(`/items/${resolveButton.dataset.resolveItem}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'resolved' })
        });
        showToast('Item marked resolved.', 'success');
        await Promise.all([loadMyItems('lost', '#my-lost-items'), loadMyItems('found', '#my-found-items')]);
      }

      if (deleteButton) {
        await request(`/items/${deleteButton.dataset.deleteItem}`, {
          method: 'DELETE'
        });
        showToast('Item deleted.', 'success');
        await Promise.all([loadMyItems('lost', '#my-lost-items'), loadMyItems('found', '#my-found-items')]);
      }

      if (claimButton) {
        const [claimId, status] = claimButton.dataset.claimAction.split(':');
        await request(`/claims/${claimId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        showToast(`Claim ${status}.`, 'success');
        await loadClaims();
        await Promise.all([loadMyItems('lost', '#my-lost-items'), loadMyItems('found', '#my-found-items')]);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
};

const initChat = async (user) => {
  const chat = new ChatManager({
    mode: 'dashboard',
    currentUser: user,
    elements: {
      list: document.querySelector('#conversation-list'),
      messages: document.querySelector('#chat-messages'),
      form: document.querySelector('#chat-form'),
      input: document.querySelector('#chat-input'),
      typing: document.querySelector('#chat-typing'),
      title: document.querySelector('#chat-title'),
      meta: document.querySelector('#chat-meta')
    }
  });

  await chat.init();
};

const init = async () => {
  if (document.body.dataset.page !== 'dashboard') {
    return;
  }

  const user = await requireAuth();

  if (!user) {
    return;
  }

  document.querySelector('#dashboard-user').textContent = user.name;
  setupActions();
  await setupItemComposer();
  await Promise.all([loadMyItems('lost', '#my-lost-items'), loadMyItems('found', '#my-found-items'), loadClaims()]);
  await initChat(user);
};

document.addEventListener('DOMContentLoaded', init);
