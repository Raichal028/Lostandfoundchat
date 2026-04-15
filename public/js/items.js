import {
  createSkeletonCards,
  debounce,
  escapeHtml,
  formatDate,
  makeAvatar,
  request,
  showToast
} from '/js/api.js';
import { hydrateUser } from '/js/auth.js';
import { ChatManager } from '/js/chat.js';

const homeState = {
  q: '',
  category: '',
  location: '',
  sort: 'latest',
  lostPage: 1,
  foundPage: 1
};

const itemCard = (item) => `
  <article class="item-card fade-in">
    <div class="item-card-image-wrap">
      <img src="${item.image || '/placeholder.svg'}" alt="${escapeHtml(item.title)}" loading="lazy" class="item-card-image" />
      <span class="badge badge-${item.type === 'lost' ? 'warn' : 'accent'}">${escapeHtml(item.type)}</span>
    </div>
    <div class="item-card-body">
      <div class="card-topline">
        <h3>${escapeHtml(item.title)}</h3>
        <span>${formatDate(item.dateLost || item.dateFound || item.createdAt)}</span>
      </div>
      <p>${escapeHtml(item.description.slice(0, 110))}${item.description.length > 110 ? '...' : ''}</p>
      <div class="card-meta">
        <span>${escapeHtml(item.location)}</span>
        <span>${escapeHtml(item.category)}</span>
      </div>
      <div class="inline-actions">
        <button class="btn btn-ghost" type="button" data-preview-item="${encodeURIComponent(JSON.stringify(item))}">Preview</button>
        <a class="btn btn-primary" href="/item?id=${item._id}">Contact poster</a>
      </div>
    </div>
  </article>
`;

const setupModal = () => {
  const modal = document.querySelector('#preview-modal');

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-preview-item]');
    const closeButton = event.target.closest('[data-close-modal]');

    if (openButton) {
      const item = JSON.parse(decodeURIComponent(openButton.dataset.previewItem));
      modal.querySelector('.modal-media img').src = item.image || '/placeholder.svg';
      modal.querySelector('.modal-media img').alt = item.title;
      modal.querySelector('.modal-copy').innerHTML = `
        <span class="badge badge-${item.type === 'lost' ? 'warn' : 'accent'}">${escapeHtml(item.type)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="card-meta">
          <span>${escapeHtml(item.location)}</span>
          <span>${formatDate(item.dateLost || item.dateFound || item.createdAt)}</span>
        </div>
        <a class="btn btn-primary" href="/item?id=${item._id}">Open detail page</a>
      `;
      modal.classList.add('open');
    }

    if (closeButton || event.target === modal) {
      modal.classList.remove('open');
    }
  });
};

const renderPagination = (container, type, pagination) => {
  container.innerHTML = `
    <button class="btn btn-ghost" type="button" data-page-nav="${type}:prev" ${
      pagination.page <= 1 ? 'disabled' : ''
    }>Previous</button>
    <span>Page ${pagination.page} of ${pagination.pages}</span>
    <button class="btn btn-ghost" type="button" data-page-nav="${type}:next" ${
      pagination.page >= pagination.pages ? 'disabled' : ''
    }>Next</button>
  `;
};

const loadHomeItems = async (type) => {
  const grid = document.querySelector(`#${type}-grid`);
  const pager = document.querySelector(`#${type}-pagination`);
  const page = homeState[`${type}Page`];

  createSkeletonCards(grid, 3);

  const params = new URLSearchParams({
    type,
    q: homeState.q,
    category: homeState.category,
    location: homeState.location,
    sort: homeState.sort,
    page,
    limit: 6
  });

  const { items, pagination } = await request(`/items?${params.toString()}`, { auth: false });

  grid.innerHTML = items.length
    ? items.map(itemCard).join('')
    : '<div class="empty-state">No items matched your filters.</div>';

  renderPagination(pager, type, pagination);
};

const setupFilters = () => {
  const refresh = debounce(async () => {
    homeState.lostPage = 1;
    homeState.foundPage = 1;
    await Promise.all([loadHomeItems('lost'), loadHomeItems('found')]);
  }, 250);

  document.querySelector('#search-input')?.addEventListener('input', (event) => {
    homeState.q = event.target.value.trim();
    refresh();
  });

  document.querySelector('#category-filter')?.addEventListener('change', (event) => {
    homeState.category = event.target.value;
    refresh();
  });

  document.querySelector('#location-filter')?.addEventListener('input', (event) => {
    homeState.location = event.target.value.trim();
    refresh();
  });

  document.querySelector('#sort-filter')?.addEventListener('change', (event) => {
    homeState.sort = event.target.value;
    refresh();
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-page-nav]');

    if (!button) {
      return;
    }

    const [type, direction] = button.dataset.pageNav.split(':');
    homeState[`${type}Page`] += direction === 'next' ? 1 : -1;
    await loadHomeItems(type);
  });
};

const renderOwnerClaims = (claims = []) => {
  const wrapper = document.querySelector('#owner-claims');

  if (!wrapper) {
    return;
  }

  wrapper.innerHTML = claims.length
    ? claims
        .map(
          (claim) => `
            <article class="mini-card">
              <div class="mini-card-head">
                <span class="badge badge-${claim.status === 'pending' ? 'warn' : claim.status === 'accepted' ? 'success' : 'danger'}">${escapeHtml(claim.status)}</span>
                <span>${escapeHtml(claim.claimer.name)}</span>
              </div>
              <p>${escapeHtml(claim.message)}</p>
              ${
                claim.status === 'pending'
                  ? `
                    <div class="inline-actions">
                      <button class="btn btn-primary" type="button" data-item-claim="${claim._id}:accepted">Accept</button>
                      <button class="btn btn-ghost" type="button" data-item-claim="${claim._id}:rejected">Reject</button>
                    </div>
                  `
                  : ''
              }
            </article>
          `
        )
        .join('')
    : '<div class="empty-state compact">No claim requests yet.</div>';
};

const setupItemPage = async () => {
  if (document.body.dataset.page !== 'item') {
    return;
  }

  const user = await hydrateUser();
  const itemId = new URLSearchParams(window.location.search).get('id');

  if (!itemId) {
    window.location.href = '/';
    return;
  }

  try {
    const { item, matches, claims } = await request(`/items/${itemId}`);

    const isOwner = user && String(user._id) === String(item.postedBy._id);
    document.querySelector('#item-image').src = item.image || '/placeholder.svg';
    document.querySelector('#item-title').textContent = item.title;
    document.querySelector('#item-description').textContent = item.description;
    document.querySelector('#item-location').textContent = item.location;
    document.querySelector('#item-date').textContent = formatDate(
      item.dateLost || item.dateFound || item.createdAt
    );
    document.querySelector('#item-category').textContent = item.category;
    document.querySelector('#item-status').textContent = item.status;
    document.querySelector('#item-type').textContent = item.type;
    document.querySelector('#item-user-name').textContent = item.postedBy.name;
    document.querySelector('#item-user-email').textContent = item.postedBy.email;
    document.querySelector('#item-user-avatar').innerHTML = makeAvatar(item.postedBy);

    document.querySelector('#match-grid').innerHTML = matches.length
      ? matches
          .map(
            (match) => `
              <a class="suggestion-card" href="/item?id=${match._id}">
                <strong>${escapeHtml(match.title)}</strong>
                <span>${escapeHtml(match.location)}</span>
                <small>${Math.round(match.matchScore * 100)}% match</small>
              </a>
            `
          )
          .join('')
      : '<div class="empty-state compact">No close matches yet.</div>';

    renderOwnerClaims(isOwner ? claims : []);
    document.querySelector('#owner-claims-panel').hidden = !isOwner;
    document.querySelector('#claim-trigger').hidden = isOwner || !user;
    document.querySelector('#chat-trigger').hidden = !user || isOwner;

    if (user && !isOwner) {
      const chat = new ChatManager({
        mode: 'direct',
        currentUser: user,
        activeConversation: {
          itemId: item._id,
          participantId: item.postedBy._id,
          participant: item.postedBy,
          item
        },
        elements: {
          messages: document.querySelector('#direct-chat-messages'),
          form: document.querySelector('#direct-chat-form'),
          input: document.querySelector('#direct-chat-input'),
          typing: document.querySelector('#direct-chat-typing'),
          title: document.querySelector('#direct-chat-title'),
          meta: document.querySelector('#direct-chat-meta')
        }
      });

      document.querySelector('#chat-trigger').addEventListener('click', async () => {
        document.querySelector('#chat-modal').classList.add('open');
        await chat.init();
      });
    }

    document.querySelector('#claim-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        const body = new FormData(event.currentTarget);
        await request('/claims', {
          method: 'POST',
          body: JSON.stringify({
            itemId: item._id,
            message: body.get('message')
          })
        });
        showToast('Claim sent to the poster.', 'success');
        document.querySelector('#claim-modal').classList.remove('open');
        event.currentTarget.reset();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }

  document.addEventListener('click', async (event) => {
    const openClaim = event.target.closest('#claim-trigger');
    const closeButton = event.target.closest('[data-close-modal]');
    const claimAction = event.target.closest('[data-item-claim]');

    if (openClaim) {
      document.querySelector('#claim-modal').classList.add('open');
    }

    if (closeButton) {
      closeButton.closest('.modal-overlay').classList.remove('open');
    }

    if (claimAction) {
      const [claimId, status] = claimAction.dataset.itemClaim.split(':');

      try {
        await request(`/claims/${claimId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        showToast(`Claim ${status}.`, 'success');
        window.location.reload();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  });
};

const initHomePage = async () => {
  if (document.body.dataset.page !== 'home') {
    return;
  }

  setupModal();
  setupFilters();
  await Promise.all([loadHomeItems('lost'), loadHomeItems('found')]);
};

document.addEventListener('DOMContentLoaded', async () => {
  await initHomePage();
  await setupItemPage();
});
