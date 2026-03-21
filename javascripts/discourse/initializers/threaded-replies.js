import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";

export default apiInitializer("0.8", (api) => {
  api.decorateCookedElement((elem, helper) => {
    const post = helper.getModel();

    if (!post || !post.reply_count) return;
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
