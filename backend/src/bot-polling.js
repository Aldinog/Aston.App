// src/bot-polling.js
require('dotenv').config();
const { Telegraf } = require('telegraf');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_GROUP_IDS = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
const MINI_APP_URL = "https://t.me/astonaicbot/astonmology";

// Helper to check if chat is allowed
function isAllowed(chatId) {
  if (ALLOWED_GROUP_IDS.length === 0) return true;
  return ALLOWED_GROUP_IDS.includes(chatId.toString());
}

const bot_reply_redirect = (ctx) => {
  return ctx.reply("🤖 <b>Silakan gunakan App Astonmology untuk fitur ini.</b>", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka App", url: MINI_APP_URL }]
      ]
    }
  });
};

function startPollingBot() {
  if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN missing in env');
  const bot = new Telegraf(TELEGRAM_TOKEN);
  console.log('Telegram bot polling started (Telegraf).');

  // ====== Middleware: Authorization & Logging ======
  bot.use((ctx, next) => {
    if (!ctx.message || !ctx.message.text) return next();

    const chatId = ctx.chat.id;

    // Check Allowed Groups
    if (!isAllowed(chatId)) {
      if (ctx.chat.type !== 'private') {
        // Silent ignore for unauthorized groups
        return;
      }
    }
    return next();
  });

  // ====== Commands ======

  bot.command('cekchatid', (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    return ctx.reply(`🆔 <b>Chat Info</b>\n\n• Chat ID: <code>${chatId}</code>\n• User ID: <code>${userId}</code>`, { parse_mode: "HTML" });
  });

  bot.command('help', async (ctx) => {
    const helpMsg = `
<b>Panduan Penggunaan Aston AI Bot</b>

🚀 <b>Semua Fitur Pindah Ke App!</b>
Sekarang Anda bisa melakukan Analisa, Cek Harga, Signal, dan Review Setup lebih mudah melalui Mini App kami.

🤖 <b>Fitur Utama di Mini App:</b>
• /harga, /indikator, /analisa
• /proxy, /signal, /review
• /fundamental

<i>Mulai sekarang dengan klik tombol di bawah!</i>
    `;
    await ctx.reply(helpMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Buka App", url: MINI_APP_URL }]
        ]
      }
    });
  });

  bot.command('start', (ctx) => {
    ctx.reply("🤖 Bot aktif. Silakan gunakan perintah /help untuk panduan.");
  });

  // ====== Redirect All Major Commands ======
  const redirectCommands = ['analisa', 'review', 'harga', 'indikator', 'proxy', 'signal', 'fundamental'];
  bot.command(redirectCommands, (ctx) => {
    return bot_reply_redirect(ctx);
  });

  // Launch
  bot.launch().catch(err => console.error('Bot Launch Error:', err));

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

if (require.main === module) {
  startPollingBot();
}

module.exports = { startPollingBot };
