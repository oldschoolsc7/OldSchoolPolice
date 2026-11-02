const form = document.getElementById("application-form");
const statusBox = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const discordInput = document.getElementById("discordId");

const COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "oldschool_application_last_submit_";

function getCooldown(discordId) {
  if (!discordId) return null;

  const saved = localStorage.getItem(STORAGE_PREFIX + discordId);
  if (!saved) return null;

  const lastSubmit = Number(saved);
  if (!Number.isFinite(lastSubmit)) {
    localStorage.removeItem(STORAGE_PREFIX + discordId);
    return null;
  }

  const remaining = COOLDOWN_MS - (Date.now() - lastSubmit);
  return remaining > 0 ? remaining : null;
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} يوم و${hours} ساعة و${minutes} دقيقة و${seconds} ثانية`;
}

function showCooldown(remaining) {
  statusBox.textContent = `سبق وقدمت طلب. تقدر تقدم مرة ثانية بعد: ${formatRemaining(remaining)}.`;
  statusBox.className = "form-status error";
  submitBtn.disabled = true;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "form-status";
  submitBtn.disabled = false;
}

function checkApplicantCooldown() {
  const discordId = String(discordInput.value || "").trim();
  const remaining = getCooldown(discordId);

  if (remaining) {
    showCooldown(remaining);
    return true;
  }

  clearStatus();
  return false;
}

discordInput.addEventListener("input", checkApplicantCooldown);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const discordId = String(data.get("discordId") || "").trim();

  // منع إعادة التقديم خلال أربعة أيام من آخر طلب ناجح على هذا المتصفح.
  const remaining = getCooldown(discordId);
  if (remaining) {
    showCooldown(remaining);
    return;
  }

  const config = window.OLD_SCHOOL_CONFIG || {};
  const webhook = config.WEBHOOK_URL || "";

  if (!webhook.startsWith("https://discord.com/api/webhooks/") &&
      !webhook.startsWith("https://discordapp.com/api/webhooks/")) {
    statusBox.textContent = "لم يتم إعداد رابط الويب هوك بعد. افتح assets/config.js وأضف الرابط.";
    statusBox.className = "form-status error";
    return;
  }

  const fields = [
    ["الاسم الكامل", data.get("fullName")],
    ["العمر", data.get("age")],
    ["منشن المتقدم", `<@${discordId}>`],
    ["Discord ID — قابل للنسخ", `\`${discordId}\``],
    ["اسم الشخصية", data.get("characterName")],
    ["رقم الهوية", data.get("identityNumber")],
    ["الخبرات السابقة", data.get("experience") || "لم يذكر"],
    ["سبب التقديم", data.get("reason")]
  ];

  const embed = {
    title: "طلب تقديم جديد | وزارة الداخلية",
    description: "تم استلام طلب جديد، يرجى مراجعته واتخاذ القرار المناسب.",
    color: 2067276,
    fields: fields.map(([name, value]) => ({
      name,
      value: String(value).slice(0, 1024) || "—",
      inline: ["العمر", "منشن المتقدم", "Discord ID — قابل للنسخ"].includes(name)
    })),
    footer: { text: "OLD SCHOOL | وزارة الداخلية" },
    timestamp: new Date().toISOString()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "جارٍ الإرسال...";
  statusBox.textContent = "";

  try {
    const response = await fetch(webhook + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `طلب تقديم جديد من <@${discordId}> | Discord ID: \`${discordId}\``,
        embeds: [embed],
        allowed_mentions: { parse: [], users: [discordId] }
      })
    });

    if (!response.ok) throw new Error("Webhook rejected request");

    // يبدأ الحظر فقط بعد نجاح إرسال الطلب إلى Discord.
    localStorage.setItem(STORAGE_PREFIX + discordId, String(Date.now()));
    form.reset();
    statusBox.textContent = "تم إرسال الطلب بنجاح. لا يمكنك التقديم مرة أخرى إلا بعد مرور 4 أيام.";
    statusBox.className = "form-status success";
    submitBtn.disabled = true;
  } catch (error) {
    statusBox.textContent = "تعذر الإرسال. تحقق من رابط الويب هوك وإعداداته، أو استخدم وسيطًا آمنًا لإرسال الطلبات.";
    statusBox.className = "form-status error";
    submitBtn.disabled = false;
  } finally {
    submitBtn.textContent = "إرسال الطلب";
  }
});
