import StaticMaps from 'staticmaps'
import { Keyboard, Key } from 'telegram-keyboard'
import { Telegraf } from 'telegraf'
import dotenv from 'dotenv'
import fs from 'fs'
import axios from 'axios'
import mongoose from 'mongoose'
import { reportSchema, adminSchema } from './database.js'
import { uploadFileOnPinata } from './ipfs.js'
import { help } from './shared.js'
import { sendMessageToWhatsapp } from './whatsapp.js'
dotenv.config()
let reports = {}

export const runBot = () => {
    const bot = new Telegraf(process.env.BOT_TOKEN)


    bot.help((ctx) => ctx.reply(help))
    bot.start((ctx) => ctx.reply(help))

    bot.on('photo', (ctx) => {
        try {
            const user = ctx.update.message.from.id
            if (reports[user] === undefined) {
                reports[user] = {
                    photo: "",
                    location: {}
                }
            }
            const fileId = ctx.update.message.photo[3].file_id
            console.log('📸 RECEIVED PICTURE', fileId);
            ctx.telegram.getFileLink(fileId).then(url => {
                url = url.href
                console.log("Downloading from file link:", url)
                axios({ url, responseType: 'stream' }).then(response => {
                    response.data.pipe(fs.createWriteStream(`./photos/${fileId}.jpg`))
                        .on('finish', async () => {
                            const file = fs.readFileSync(`./photos/${fileId}.jpg`)
                            const uploaded = await uploadFileOnPinata(file, fileId + '.jpg')
                            console.log("Upload on Pinata result:", uploaded)
                            if (uploaded === false) {
                                ctx.reply("C'è stato un problema con l'upload della foto, riprova!")
                            } else {
                                reports[user].photo = process.env.PINATA_ENDPOINT + "/ipfs/" + uploaded
                                ctx.reply('Ok, ora allega la tua 📍 posizione, così da poterla accoppiare con la foto e geolocalizzare la discarica.')
                            }
                        })
                        .on('error', e => {
                            ctx.reply('Abbiamo riscontrato un problema con la foto, prova di nuovo..')
                        })
                })
            })
        } catch (e) {
            console.log(e.message)
            ctx.reply("È successo qualcosa di strano..riprova!")
        }
    })

    bot.on('video', (ctx) => {
        ctx.reply('Ci dispiace, accettiamo solamente fotografie.')
    })

    bot.on('location', async (ctx) => {
        try {
            const user = ctx.update.message.from.id
            console.log('📍 RECEIVED LOCATION', ctx.update.message.location);
            if (reports[user] !== undefined) {
                const reportModel = mongoose.model('report', reportSchema);
                const check = await reportModel.findOne({ photo: reports[user].photo })

                if (check === null) {
                    reports[user].location = ctx.update.message.location;
                    const report = new reportModel();
                    report.photo = reports[user].photo
                    report.location = {
                        "type": "Point",
                        "coordinates": [
                            ctx.update.message.location.longitude,
                            ctx.update.message.location.latitude
                        ]
                    }
                    report.from = user
                    report.source = 'telegram'
                    report.approved = false
                    report.evalued = false
                    report.timestamp = new Date().getTime()
                    await report.save();

                    await reportModel.findOne({ photo: reports[user].photo })

                    ctx.replyWithMarkdownV2(`🎉🎉🎉 Ben fatto, non resta che aspettare l'approvazione\\! Impieghiamo massimo 24h\\!\n\nGrazie per aver partecipato all'iniziativa di MunnizzaLand\\. Le tue segnalazioni sono importanti, continua ad aiutarci\\!\n\nPuoi vedere la mappa di tutte le segnalazioni approvate sul sito di Munnizza\\.Land:\n\nhttps://munnizza\\.land`)

                    // SEND IMAGE TO ADMIN
                    const adminModel = mongoose.model('admins', adminSchema);
                    const admin = await adminModel.findOne({ approved: true })
                    if (admin !== null) {
                        ctx.telegram.sendMessage(parseInt(admin.chatId), "Devi validare una foto, usa /validate per iniziare la procedura!")
                    } else {
                        console.log("Non posso notificare nessuno..")
                    }
                } else {
                    ctx.reply("Questa foto è già stata segnalata, grazie per la collaborazione!")
                }
                // Reset in-memory report
                reports[user] = {
                    photo: "",
                    location: {}
                }

            } else {
                ctx.reply('Invia una foto prima!')
            }
        } catch (e) {
            console.log(e.message)
            ctx.reply("È successo qualcosa di strano..riprova!")
        }
    })

    bot.command('auth', async (ctx) => {
        console.log("Received auth request from: " + ctx.update.message.from.username)
        const adminModel = mongoose.model('admins', adminSchema);
        const admin = await adminModel.findOne({ username: ctx.update.message.from.username })
        if (admin === null) {
            if (ctx.update.message.from.username === process.env.MANAGER) {
                const newAdmin = new adminModel();
                newAdmin.username = ctx.update.message.from.username
                newAdmin.approved = false
                newAdmin.chatId = ctx.update.message.from.id
                await newAdmin.save();
                await ctx.reply("Che la forza sia con te!")
                ctx.replyWithAnimation("https://github.com/yomi-digital/munnizza-land/blob/master/assets/master_dance.gif?raw=true")
            } else {
                ctx.replyWithAnimation("https://github.com/yomi-digital/munnizza-land/blob/master/assets/no_master.gif?raw=true")
            }
        } else if (admin.approved === true) {
            ctx.reply("Sei già un amministratore!")
        } else if (admin.approved === false) {
            ctx.reply("Questo utente è già in attesa di approvazione!")
        }
    })

    bot.command('validate', async ctx => {
        const adminModel = mongoose.model('admins', adminSchema);
        const admin = await adminModel.findOne({ username: ctx.update.message.from.username, approved: true })
        if (admin !== null && admin.chatId === ctx.update.message.from.id.toString()) {
            const reportModel = mongoose.model('report', reportSchema);
            const reports = await reportModel.find({ evalued: false })
            if (reports.length > 0) {
                let toValidate = []
                for (let k in reports) {
                    const report = reports[k]
                    // Sending photo and location
                    await ctx.reply('💥💥Arrivata foto!💥💥\n' + report.photo)
                    await ctx.reply(`https://www.google.com/maps/search/?api=1&query=${report.location.coordinates[1]},${report.location.coordinates[0]}`)
                    try {
                        const geocoding = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${report.location.coordinates[0]},${report.location.coordinates[1]}.json?access_token=${process.env.MAPBOX_TOKEN}`)
                        if (geocoding.data.features !== undefined) {
                            for (let k in geocoding.data.features) {
                                const feature = geocoding.data.features[k]
                                if (feature.place_type[0] === 'poi') {
                                    await ctx.reply("🏢 " + feature.place_name)
                                } else if (feature.place_type[0] === 'place') {
                                    await ctx.reply("🗺️ " + feature.text)
                                } else if (feature.place_type[0] === 'address') {
                                    await ctx.reply("🏠 " + feature.text)
                                }
                            }
                        } else {
                            await ctx.reply("🤓 Non riesco a trovare l'indirizzo..")
                        }
                    } catch (e) {
                        console.log(e.message)
                        await ctx.reply("🤓 Non riesco a trovare l'indirizzo..")
                    }
                    toValidate.push(['approve:' + report._id, 'ignore:' + report._id])
                }
                const keyboard = Keyboard.make(toValidate)
                await ctx.reply("Ora scegli!", keyboard.reply())
            } else {
                const keyboard = Keyboard.make(['/validate', '/mappa'])
                await ctx.reply("Non c'è nulla da validare!", keyboard.reply())
                ctx.replyWithAnimation("https://github.com/yomi-digital/munnizza-land/blob/master/assets/master_dance.gif?raw=true")
            }
        } else {
            ctx.replyWithAnimation("https://github.com/yomi-digital/munnizza-land/blob/master/assets/no_master.gif?raw=true")
        }
    })

    bot.command('mappa', async (ctx) => {
        try {
            const reportModel = mongoose.model('report', reportSchema);
            const reports = await reportModel.find({ approved: true })
            const mapImg = process.cwd() + '/maps/' + new Date().getTime().toString() + '.png'

            const map = new StaticMaps({
                width: 600,
                height: 400
            });

            const marker = {
                img: `../marker.png`,
                offsetX: 24,
                offsetY: 48,
                width: 48,
                height: 48
            };
            for (let k in reports) {
                marker.coord = reports[k].location.coordinates;
                map.addMarker(marker);
            }
            map.render()
                .then(() => map.image.save(mapImg))
                .then(() => {
                    ctx.replyWithPhoto({ source: mapImg });
                })
                .catch((e) => {
                    console.log(e)
                    ctx.reply('Can\'t render map!')
                });
        } catch (e) {
            console.log(e.message)
            ctx.reply("È successo qualcosa di strano..riprova!")
        }
    })

    bot.on('message', async (ctx) => {
        try {
            const adminModel = mongoose.model('admins', adminSchema);
            const admin = await adminModel.findOne({ username: ctx.update.message.from.username, approved: true })
            if (admin !== null) {
                const text = ctx.update.message.text
                if (text.indexOf('approve:') !== -1 || text.indexOf('ignore:') !== -1) {
                    const action = text.split(':')
                    const reportModel = mongoose.model('report', reportSchema);
                    const report = await reportModel.findOne({ _id: action[1] })
                    if (report !== undefined && report !== null) {
                        if (action[0] === 'approve') {
                            report.evalued = true
                            report.approved = true
                            await report.save()
                            await ctx.reply("Report validato correttamente!")
                            const acceptMsg = "Grazie, il tuo report è stato accettato ed inserito nella mappa!"
                            // Removing temporary user reference
                            if (report.source === 'telegram') {
                                await ctx.telegram.sendMessage(parseInt(report.from), acceptMsg)
                            } else if (report.source === 'whatsapp' && report.from.split('@').length === 2) {
                                await sendMessageToWhatsapp(report.from.split('@')[0], report.from.split('@')[1], acceptMsg)
                            }
                            report.from = undefined
                            await report.save()
                        } else {
                            report.evalued = true
                            report.approved = false
                            await report.save()
                            await ctx.reply("Report ignorato correttamente!")
                            const denyMsg = "Ci dispiace, ma il tuo report non è stato ritenuto idoneo ad essere inserito!"
                            // Removing temporary user reference
                            if (report.source === 'telegram') {
                                await ctx.telegram.sendMessage(parseInt(report.from), denyMsg)
                            } else if (report.source === 'whatsapp' && report.from.split('@').length === 2) {
                                await sendMessageToWhatsapp(report.from.split('@')[0], report.from.split('@')[1], denyMsg)
                            }
                            report.from = undefined
                            await report.save()
                        }
                    } else {
                        await ctx.reply("Questo report non esiste...")
                    }
                }
            } else {
                ctx.replyWithAnimation("https://github.com/yomi-digital/munnizza-land/blob/master/assets/no_master.gif?raw=true")
            }
        } catch (e) {
            console.log(e.message)
            ctx.reply("È successo qualcosa di strano..riprova!")
        }
    })

    bot.launch()
    console.log('🤖 TELEGRAM BOT STARTED!')
}