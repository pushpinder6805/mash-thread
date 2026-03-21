import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";

export default apiInitializer("0.8", (api) => {
  api.decorateCookedElement((elem, helper) => {
    const post = helper.getModel();

    if (!post || !post.reply_count) return;
    if (elem.querySelector(".thr-thread-box")) return;

    const threadBox = document.createElement("div");
    threadBox.className = "thr-thread-box";

    const toggleRow = document.createElement("div");
    toggleRow.className = "thr-toggle-row";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "thr-toggle-btn";
    toggleBtn.innerHTML = `
      <span class="thr-reply-count">${post.reply_count} ${post.reply_count === 1 ? "Reply" : "Replies"}</span>
      <span class="thr-chevron">&#8964;</span>
    `;

    toggleRow.appendChild(toggleBtn);
    threadBox.appendChild(toggleRow);

    const repliesContainer = document.createElement("div");
    repliesContainer.className = "thr-replies-container thr-hidden";
    threadBox.appendChild(repliesContainer);

    elem.appendChild(threadBox);

    let loaded = false;
    let expanded = false;

    toggleBtn.addEventListener("click", async () => {
      expanded = !expanded;

      if (expanded) {
        toggleBtn.querySelector(".thr-chevron").innerHTML = "&#8963;";
        repliesContainer.classList.remove("thr-hidden");

        if (!loaded) {
          loaded = true;
          repliesContainer.innerHTML = `<div class="thr-loading">Loading replies…</div>`;

          try {
            const topicId = post.topic_id;
            const postNumber = post.post_number;

            const data = await ajax(`/posts/${post.id}/replies.json`);
            const replies = data || [];

            repliesContainer.innerHTML = "";

            const line = document.createElement("div");
            line.className = "thr-line";
            repliesContainer.appendChild(line);

            if (replies.length === 0) {
              repliesContainer.innerHTML = `<div class="thr-empty">No replies yet.</div>`;
              return;
            }

            replies.forEach((reply, index) => {
              const avatarColor = getAvatarColor(reply.username || "", index);
              const avatarHtml = reply.avatar_template
                ? `<img class="thr-avatar-img" src="${reply.avatar_template.replace("{size}", "40")}" alt="${reply.username}" />`
                : `<div class="thr-avatar-placeholder" style="background:${avatarColor}">${(reply.username || "?")[0].toUpperCase()}</div>`;

              const date = reply.created_at
                ? formatDate(reply.created_at)
                : "";

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

            const collapseBtn = document.createElement("button");
            collapseBtn.className = "thr-collapse-btn";
            collapseBtn.innerHTML = "&#8963;";
            collapseBtn.addEventListener("click", () => {
              toggleBtn.click();
            });
            repliesContainer.appendChild(collapseBtn);

          } catch (e) {
            repliesContainer.innerHTML = `<div class="thr-error">Could not load replies.</div>`;
          }
        }
      } else {
        toggleBtn.querySelector(".thr-chevron").innerHTML = "&#8964;";
        repliesContainer.classList.add("thr-hidden");
      }
    });
  });
});

function getAvatarColor(username, index) {
  const colors = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#be185d"];
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
