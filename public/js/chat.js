import {
  escapeHtml,
  formatDateTime,
  getToken,
  makeAvatar,
  request,
  showToast
} from '/js/api.js';

const ensureSocket = () => {
  if (!window.io) {
    throw new Error('Socket.io client is unavailable');
  }

  return window.io('/', {
    auth: {
      token: getToken()
    }
  });
};

const renderMessageBubble = (message, currentUserId) => {
  const mine = String(message.sender._id || message.sender) === String(currentUserId);

  return `
    <div class="message-row ${mine ? 'mine' : ''}">
      <div class="message-bubble">
        <p>${escapeHtml(message.message)}</p>
        <span>${formatDateTime(message.createdAt)} ${mine && message.seen ? '• Seen' : ''}</span>
      </div>
    </div>
  `;
};

const renderConversationItem = (conversation, activeKey) => {
  const key = `${conversation.item._id}:${conversation.participant._id}`;
  return `
    <button
      class="conversation-item ${activeKey === key ? 'active' : ''}"
      type="button"
      data-conversation-key="${key}"
    >
      <div class="avatar small">${makeAvatar(conversation.participant)}</div>
      <div>
        <strong>${escapeHtml(conversation.participant.name)}</strong>
        <span>${escapeHtml(conversation.item.title)}</span>
      </div>
      ${
        conversation.unreadCount
          ? `<span class="badge badge-accent">${conversation.unreadCount}</span>`
          : ''
      }
    </button>
  `;
};

export class ChatManager {
  constructor(options) {
    this.mode = options.mode || 'dashboard';
    this.currentUser = options.currentUser;
    this.elements = options.elements;
    this.activeConversation = options.activeConversation || null;
    this.conversations = [];
    this.typingTimer = null;
    this.socket = ensureSocket();
    this.bindSocket();
    this.bindInput();
  }

  bindSocket() {
    this.socket.on('notification', (payload) => {
      showToast(payload.message, 'info');
    });

    this.socket.on('chat:message', (message) => {
      const active =
        this.activeConversation &&
        String(this.activeConversation.itemId) === String(message.itemId) &&
        [String(message.sender._id || message.sender), String(message.receiver._id || message.receiver)].includes(
          String(this.activeConversation.participantId)
        );

      if (active) {
        this.appendMessage(message);
        this.markSeen();
      } else if (this.mode === 'dashboard') {
        this.loadConversations();
      }
    });

    this.socket.on('chat:typing', ({ itemId, senderId }) => {
      if (
        !this.activeConversation ||
        String(this.activeConversation.itemId) !== String(itemId) ||
        String(this.activeConversation.participantId) !== String(senderId)
      ) {
        return;
      }

      this.elements.typing.textContent = 'Typing...';
      window.clearTimeout(this.typingTimer);
      this.typingTimer = window.setTimeout(() => {
        this.elements.typing.textContent = '';
      }, 1200);
    });

    this.socket.on('chat:seen', ({ itemId, participantId }) => {
      if (
        this.activeConversation &&
        String(this.activeConversation.itemId) === String(itemId) &&
        String(this.activeConversation.participantId) === String(participantId)
      ) {
        this.loadMessages();
      }
    });
  }

  bindInput() {
    if (this.elements.form) {
      this.elements.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.sendMessage();
      });
    }

    if (this.elements.input) {
      this.elements.input.addEventListener('input', () => {
        if (!this.activeConversation || !this.elements.input.value.trim()) {
          return;
        }

        this.socket.emit('chat:typing', {
          itemId: this.activeConversation.itemId,
          partnerId: this.activeConversation.participantId
        });
      });
    }

    if (this.mode === 'dashboard' && this.elements.list) {
      this.elements.list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-conversation-key]');

        if (!button) {
          return;
        }

        const [itemId, participantId] = button.dataset.conversationKey.split(':');
        const conversation = this.conversations.find(
          (entry) =>
            String(entry.item._id) === String(itemId) &&
            String(entry.participant._id) === String(participantId)
        );

        if (conversation) {
          this.openConversation(conversation);
        }
      });
    }
  }

  async init() {
    if (this.mode === 'dashboard') {
      await this.loadConversations();
    } else {
      this.socket.emit('chat:join', {
        itemId: this.activeConversation.itemId,
        partnerId: this.activeConversation.participantId
      });
      await this.loadMessages();
    }
  }

  async loadConversations() {
    const { conversations } = await request('/messages/conversations/list');
    this.conversations = conversations;
    this.renderConversationList();

    if (!this.activeConversation && conversations[0]) {
      await this.openConversation(conversations[0]);
    }

    if (!conversations.length) {
      this.elements.list.innerHTML = '<div class="empty-state compact">No conversations yet.</div>';
      this.elements.messages.innerHTML = '<div class="empty-state">Open a conversation from an item page.</div>';
    }
  }

  renderConversationList() {
    if (!this.elements.list) {
      return;
    }

    const activeKey = this.activeConversation
      ? `${this.activeConversation.itemId}:${this.activeConversation.participantId}`
      : '';

    this.elements.list.innerHTML = this.conversations
      .map((conversation) => renderConversationItem(conversation, activeKey))
      .join('');
  }

  async openConversation(conversation) {
    this.activeConversation = {
      itemId: conversation.item._id,
      participantId: conversation.participant._id,
      participant: conversation.participant,
      item: conversation.item
    };

    this.socket.emit('chat:join', {
      itemId: conversation.item._id,
      partnerId: conversation.participant._id
    });

    this.renderConversationList();
    this.updateHeader();
    await this.loadMessages();
  }

  updateHeader() {
    if (this.elements.title) {
      this.elements.title.textContent = this.activeConversation?.participant?.name || 'Conversation';
    }

    if (this.elements.meta) {
      this.elements.meta.textContent = this.activeConversation?.item?.title || '';
    }
  }

  async loadMessages() {
    if (!this.activeConversation) {
      return;
    }

    const { messages } = await request(
      `/messages/${this.activeConversation.itemId}?participantId=${this.activeConversation.participantId}`
    );

    this.elements.messages.innerHTML = messages.length
      ? messages.map((message) => renderMessageBubble(message, this.currentUser._id)).join('')
      : '<div class="empty-state compact">Start the conversation.</div>';

    this.scrollMessages();
    await this.markSeen();

    if (this.mode === 'dashboard') {
      this.loadConversations();
    }
  }

  appendMessage(message) {
    const empty = this.elements.messages.querySelector('.empty-state');

    if (empty) {
      empty.remove();
    }

    this.elements.messages.insertAdjacentHTML(
      'beforeend',
      renderMessageBubble(message, this.currentUser._id)
    );
    this.scrollMessages();
  }

  scrollMessages() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }

  async markSeen() {
    if (!this.activeConversation) {
      return;
    }

    this.socket.emit('chat:seen', {
      itemId: this.activeConversation.itemId,
      partnerId: this.activeConversation.participantId
    });

    await request(`/messages/${this.activeConversation.itemId}/seen`, {
      method: 'PUT',
      body: JSON.stringify({
        participantId: this.activeConversation.participantId
      })
    }).catch(() => {});
  }

  async sendMessage() {
    const content = this.elements.input?.value.trim();

    if (!content || !this.activeConversation) {
      return;
    }

    await new Promise((resolve) => {
      this.socket.emit(
        'chat:send',
        {
          itemId: this.activeConversation.itemId,
          receiverId: this.activeConversation.participantId,
          message: content
        },
        (response) => {
          if (!response.ok) {
            showToast(response.message, 'error');
          } else {
            this.elements.input.value = '';
          }

          resolve();
        }
      );
    });
  }
}
