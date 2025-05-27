document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get("mode", (data) => {
    const mode = data.mode || "raw"; 
    const input = document.querySelector(`input[value=${mode}]`);
    if (input) input.checked = true;
  });

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      const selectedMode = input.value;
      chrome.storage.sync.set({ mode: selectedMode }, () => {
        const status = document.getElementById("status");
        status.textContent = "Saved!";
        setTimeout(() => (status.textContent = ""), 1000);
      });
    });
  });
});
