import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";

export default apiInitializer("0.8", (api) => {
  api.decorateCookedElement((elem, helper) => {
    const post = helper.getModel();

    if (!post) return;

    if (post.post_number === 1) {
      if (!elem.querySelector(".thr-topic-stats")) {
        injectTopicStats(post, elem);
      }
      return;
    }

    if (!post.reply_count) return;
    if (elem.querySelector(".thr-thread-box")) return;

    hideNativeReplies(elem);

    const threadBox = document.createElement("div");
    threadBox.className = "thr-thread-box";

    const toggleRow = document.createElement("div");
    toggleRow.className = "thr-toggle-row";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "thr-toggle-btn thr-expanded";
    toggleBtn.innerHTML = `
      <span class="thr-reply-count">${post.reply_count} ${post.reply_count === 1 ? "Reply" : "Replies"}</span>
      <span class="thr-chevron">&#8963;</span>
    `;

    toggleRow.appendChild(toggleBtn);
    threadBox.appendChild(toggleRow);

    const repliesContainer = document.createElement("div");
    repliesContainer.className = "thr-replies-container";
    threadBox.appendChild(repliesContainer);

    elem.appendChild(threadBox);

    let loaded = false;
    let expanded = true;

    loadReplies(post, repliesContainer).then((actualCount) => {
      loaded = true;
      if (typeof actualCount === "number") {
        toggleBtn.querySelector(".thr-reply-count").textContent = `${actualCount} ${actualCount === 1 ? "Reply" : "Replies"}`;
      }
    });

    toggleBtn.addEventListener("click", async () => {
      expanded = !expanded;

      if (expanded) {
        toggleBtn.querySelector(".thr-chevron").innerHTML = "&#8963;";
        toggleBtn.classList.add("thr-expanded");
        repliesContainer.classList.remove("thr-hidden");

        if (!loaded) {
          loaded = true;
          await loadReplies(post, repliesContainer);
        }
      } else {
        toggleBtn.querySelector(".thr-chevron").innerHTML = "&#8964;";
        toggleBtn.classList.remove("thr-expanded");
        repliesContainer.classList.add("thr-hidden");
      }
    });
  });
});

function injectTopicStats(post, elem) {
  const topic = post.topic;
  if (!topic) return;

  const views = topic.views || 0;
  const replyCount = topic.reply_count || 0;
  const likeCount = topic.like_count || 0;

  const statsEl = document.createElement("div");
  statsEl.className = "thr-topic-stats";
  statsEl.innerHTML = `
    <span class="thr-stat">
      <svg class="thr-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span class="thr-stat-value">${formatCount(views)}</span>
    </span>
    <span class="thr-stat-divider"></span>
    <span class="thr-stat">
      <svg class="thr-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="thr-stat-value">${formatCount(replyCount)}</span>
    </span>
    <span class="thr-stat-divider"></span>
    <span class="thr-stat">
      <svg class="thr-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span class="thr-stat-value">${formatCount(likeCount)}</span>
    </span>
  `;

  elem.appendChild(statsEl);

  injectTopicMetaBar(post, elem);
}

function injectTopicMetaBar(post, cookedElem) {
  const topic = post.topic;
  if (!topic) return;

  if (document.querySelector(".thr-meta-bar")) return;

  const contributors = topic.participant_count || topic.posters?.length || 0;
  const links = topic.links_count || 0;
  const wordCount = topic.word_count || 0;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const bar = document.createElement("div");
  bar.className = "thr-meta-bar";
  bar.innerHTML = `
    <div class="thr-meta-left">
      <span class="thr-meta-item">
        <strong>${formatCount(contributors)}</strong> Contributors
      </span>
      <span class="thr-meta-item">
        <strong>${formatCount(links)}</strong> Links
      </span>
      <span class="thr-meta-item">
        <strong>${readMinutes} min</strong> Read time
      </span>
    </div>
  `;

  const tryInsert = () => {
    if (document.querySelector(".thr-meta-bar")) return true;

    const postStream = document.querySelector(".post-stream");
    if (!postStream) return false;

    const firstPost =
      postStream.querySelector('[data-post-number="1"]') ||
      postStream.querySelector("article[id]") ||
      postStream.querySelector("article");

    if (!firstPost) return false;

    const parent = firstPost.parentNode;
    if (!parent) return false;

    parent.insertBefore(bar, firstPost.nextSibling);
    return true;
  };

  if (!tryInsert()) {
    const delays = [100, 300, 700, 1500];
    delays.forEach((ms) => {
      setTimeout(() => {
        if (!document.querySelector(".thr-meta-bar")) tryInsert();
      }, ms);
    });
  }
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n;
}

async function loadReplies(post, repliesContainer) {
  repliesContainer.innerHTML = `<div class="thr-loading">Loading replies…</div>`;

  try {
    const topicId = post.topic_id;
    const data = await ajax(`/posts/${post.id}/replies.json`);
    const replies = data || [];

    repliesContainer.innerHTML = "";

    if (replies.length === 0) {
      repliesContainer.innerHTML = `<div class="thr-empty">No replies yet.</div>`;
      return 0;
    }

    const line = document.createElement("div");
    line.className = "thr-line";
    repliesContainer.appendChild(line);

    replies.forEach((reply, index) => {
      const avatarColor = getAvatarColor(reply.username || "", index);
      const avatarHtml = reply.avatar_template
        ? `<img class="thr-avatar-img" src="${reply.avatar_template.replace("{size}", "40")}" alt="${reply.username}" />`
        : `<div class="thr-avatar-placeholder" style="background:${avatarColor}">${(reply.username || "?")[0].toUpperCase()}</div>`;

      const date = reply.created_at ? formatDate(reply.created_at) : "";
      const excerpt = stripHtml(reply.cooked || "").slice(0, 200);

      const replyEl = document.createElement("div");
      replyEl.className = "thr-reply-item";
      replyEl.innerHTML = `
        <div class="thr-reply-dot" style="background:${avatarColor}"></div>
        <div class="thr-reply-body">
          <div class="thr-reply-header">
            <div class="thr-reply-author-wrap">
              ${avatarHtml}
              <span class="thr-reply-author">${reply.name || reply.username || "Unknown"}</span>
            </div>
            <span class="thr-reply-date">${date}</span>
          </div>
          <div class="thr-reply-excerpt">${excerpt}</div>
          <a class="thr-jump-link" href="/t/${topicId}/${reply.post_number}" data-post-number="${reply.post_number}">
            <span class="thr-jump-arrow">&#8595;</span> Jump to post
          </a>
        </div>
      `;

      repliesContainer.appendChild(replyEl);
    });

    return replies.length;

  } catch (e) {
    repliesContainer.innerHTML = `<div class="thr-error">Could not load replies.</div>`;
  }
}

function hideNativeReplies(cookedElem) {
  const article = cookedElem.closest("article.boxed") || cookedElem.closest("article");
  if (!article) return;

  const tryHide = () => {
    const showRepliesBtn = article.querySelector(".post-action-menu__show-replies");
    if (showRepliesBtn) showRepliesBtn.style.setProperty("display", "none", "important");

    const embeddedBottom = article.querySelector("[id^='embedded-posts__bottom']");
    if (embeddedBottom) embeddedBottom.style.setProperty("display", "none", "important");

    const collapseUp = article.querySelector(".post__collapse-button-up");
    if (collapseUp) collapseUp.style.setProperty("display", "none", "important");
  };

  tryHide();

  const observer = new MutationObserver(tryHide);
  observer.observe(article, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 8000);
}

function getAvatarColor(username, index) {
  const colors = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#0891b2", "#be185d", "#ea580c"];
  if (username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
  return colors[index % colors.length];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
