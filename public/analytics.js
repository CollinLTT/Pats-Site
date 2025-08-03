document.addEventListener("click", e => {
  if (e.target.tagName === "IMG" && e.target.dataset.id) {
    fetch(`/api/click/${e.target.dataset.id}`, { method: "POST" });
  }
});