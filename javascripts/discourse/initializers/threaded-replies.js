// /javascripts/discourse/initializers/threaded-replies.js

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  api.decorateCookedElement((elem, helper) => {
    const post = helper.getModel();

    if (!post || !post.reply_count) return;

    // Avoid duplicate render
    if (elem.querySelector(".custom-thread-container")) return;

    const container = document.createElement("div");
    container.className = "custom-thread-container";

    container.innerHTML = `
      <div class="thread-replies-toggle">
        ${post.reply_count} Replies
      </div>
      <div class="thread-replies-list hidden"></div>
    `;

    elem.appendChild(container);

    // Toggle logic
    const toggle = container.querySelector(".thread-replies-toggle");
    const list = container.querySelector(".thread-replies-list");

    toggle.addEventListener("click", () => {
      list.classList.toggle("hidden");
    });

    // TEMP mock data (replace later)
    list.innerHTML = `
      <div class="thread-reply">
        <div class="thread-reply-card">
          <div class="thread-reply-author">John Delaney</div>
          <div class="thread-reply-meta">Jan 2026</div>
          <div>Lorem ipsum dolor sit amet...</div>
        </div>
      </div>

      <div class="thread-reply">
        <div class="thread-reply-card">
          <div class="thread-reply-author">Alice Shaw</div>
          <div class="thread-reply-meta">Jan 2026</div>
          <div>Lorem ipsum dolor sit amet...</div>
        </div>
      </div>
    `;
  });
});
