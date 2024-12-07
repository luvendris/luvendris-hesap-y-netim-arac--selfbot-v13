const { Client, MessageEmbed, Collection } = require('discord.js-selfbot-v13');
const { CustomStatus } = require('discord.js-selfbot-rpc');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const colors = require('colors');
const figlet = require('figlet');
const config = require('./config.json');
const db = require('croxydb');

function isTokenValid(token) {
  const tokenRegex = /^[A-Za-z0-9]{24}\.[A-Za-z0-9_-]{6,32}\.[A-Za-z0-9_-]{27}$/;
  return tokenRegex.test(token);
}

figlet('LUVENDRİS HY', (err, data) => {
  if (err) return console.log('Bir hata oluştu...');
  console.log(colors.cyan(data));
});

const client = new Client({ checkUpdate: false });
client.commands = new Collection();

config.bot.token.forEach((botToken, index) => {
  if (isTokenValid(botToken)) {
    client.login(botToken).then(() => {
      console.log(colors.green(`[BOT ${index + 1}] Giriş başarılı!`));
    }).catch(err => {
      console.log(colors.red(`[BOT ${index + 1}] Giriş hatası: ${err.message}`));
    });

    client.on('ready', async () => {
      console.log(colors.blue(`[BOT ${index + 1}] Bot hazır!`));

      const { voice, durum, status, activity } = config.croxydb;

      if (voice) {
        const channel = client.channels.cache.get(voice);
        if (channel) {
          try {
            joinVoiceChannel({
              channelId: voice,
              guildId: channel.guild.id,
              adapterCreator: channel.guild.voiceAdapterCreator
            });
            console.log(colors.yellow(`[BOT ${index + 1}] Ses kanalına bağlanıldı.`));
          } catch (err) {
            console.log(colors.red(`[BOT ${index + 1}] Ses kanalına bağlanırken hata: ${err.message}`));
          }
        }
      }

      if (durum && status) {
        const custom = new CustomStatus()
          .setStatus(status)
          .setState(durum);
        client.user.setPresence(custom.toData())
          .then(() => {
            console.log(colors.green(`[BOT ${index + 1}] Durum ve özel mesaj başarıyla güncellendi.`));
          })
          .catch(err => {
            console.log(colors.red(`[BOT ${index + 1}] Durum güncellenirken hata: ${err.message}`));
          });
      }

      if (activity) {
        client.user.setActivity(activity, { type: 'PLAYING' })
          .then(() => {
            console.log(colors.green(`[BOT ${index + 1}] Aktivite başarıyla güncellendi.`));
          })
          .catch(err => {
            console.log(colors.red(`[BOT ${index + 1}] Aktivite güncellenirken hata: ${err.message}`));
          });
      }

      console.log(colors.cyan(`[BOT ${index + 1}] Prefix: ${config.bot.prefix}, Owner: ${config.bot.owner}`));
    });

    client.on('messageCreate', (message) => {
      const prefix = config.bot.prefix;
      if (!message.content.startsWith(prefix) || message.author.bot) return;

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();

      if (client.commands.has(command)) {
        try {
          client.commands.get(command).execute(message, args);
        } catch (error) {
          console.error(error);
          message.reply('Bu komutta bir hata oluştu.');
        }
      }
    });
  } else {
    console.log(colors.red(`[BOT ${index + 1}] Geçersiz token! Bot bu token ile giriş yapamadı.`));
  }
});

client.commands.set('settings', {
  name: 'settings',
  description: 'Token Ayarlarına Bakarsın!',
  execute(message) {
    if (message.author.id !== config.bot.owner) return;

    const voice = db.fetch("voice");
    const status = db.fetch("status");
    const activity = db.fetch("durum");

    return message.reply(`
      Ses Durumu: ${voice ? "✅" : "❌"}
      Status Durumu: ${status ? "✅" : "❌"}
      Aktivite Durumu: ${activity ? "✅" : "❌"}
    `);
  }
});

client.commands.set('setstatus', {
  name: 'setstatus',
  description: 'Custom Status Değiştirir',
  execute(message, args) {
    if (message.author.id !== config.bot.owner) return;
    const status = args.join(" ");
    if (!status) return message.reply("Lütfen statusumun ne olacağını belirt!\nidle,dnd,online");

    new CustomStatus().setState(status);
    db.set("status", status);

    return message.reply("Status 15 saniye sonra değiştirilecek!");
  }
});

client.commands.set('setactivity', {
  name: 'setactivity',
  description: 'Aktivite Değiştirir',
  execute(message, args) {
    if (message.author.id !== config.bot.owner) return;
    const activity = args.join(" ");
    if (!activity) return message.reply("Lütfen aktivitemi ne yapacağımı belirt!\nÖrnek: Oynuyor, İzliyor");

    client.user.setActivity(activity, { type: 'PLAYING' })
      .then(() => {
        db.set("activity", activity);
        message.reply("Aktivite 15 saniye sonra değiştirilecek!");
      })
      .catch(err => {
        console.log(colors.red('Aktivite güncellenirken hata:', err.message));
        message.reply('Aktivite güncellenirken bir hata oluştu.');
      });
  }
});

client.commands.set('reset', {
  name: 'reset',
  description: 'Bot fabrika ayarlarına sıfırlanır',
  execute(message) {
    if (message.author.id !== config.bot.owner) return;

    db.delete("durum");
    db.delete("status");
    db.delete("voice");
    db.delete("activity");

    return message.reply("Bot fabrika ayarlarına getirildi.");
  }
});

client.commands.set('send-dm', {
  name: 'send-dm',
  description: 'Arkadaşlarınıza DM gönderir.',
  execute(message, args) {
    if (message.author.id !== config.bot.owner) return;
    const mesaj = args.join(" ");
    if (!mesaj) return message.reply("Lütfen bir DM mesajı belirtin!");

    message.reply("Mesajınızı arkadaşlarınıza gönderiyorum...");

    client.users.fetch().then(users => {
      users.forEach(user => {
        if (user.bot) return;
        user.send(mesaj).then(() => {
          console.log(`DM gönderildi: ${user.tag}`);
        }).catch(err => {
          console.log(`DM gönderilemedi: ${user.tag} - Hata: ${err.message}`);
        });
      });
    }).catch(err => {
      console.log("Kullanıcıları çekerken hata oluştu: " + err.message);
    });
  }
});