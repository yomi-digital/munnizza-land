import dotenv from 'dotenv'
import fs from 'fs'
import mongoose, { set } from 'mongoose'
import express from 'express'
import cors from 'cors'
import { returnAllMarkers, searchNearLocation } from './libs/database.js'
import { runBot } from './libs/telegram.js'
import { getWebhook, processWebhook } from './libs/whatsapp.js'
import body_parser from 'body-parser'
import { secureDB } from './libs/ipfs.js'
import axios from 'axios'

console.log("🤖 LOADING ENVIRONMENT..")
dotenv.config()

console.log("💽 CONNECTING TO MONGODB..")
mongoose.connect(process.env.MONGODB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true })

console.log('🚀 STARTING TELEGRAF..')
const app = express()
app.use(body_parser.json())
app.use(cors())
app.use(express.static('photos'));
const port = 3000

runBot()

if (!fs.existsSync('./photos')) {
    fs.mkdirSync('./photos')
}
if (!fs.existsSync('./maps')) {
    fs.mkdirSync('./maps')
}

app.get('/', (req, res) => {
    res.send('Bot Works!')
})

app.get('/markers', async (req, res) => {
    try {
        const markers = await returnAllMarkers()
        if (markers === false) {
            res.send("E' successo qualcosa di strano..riprova!")
        } else {
            res.send(markers)
        }
    } catch (e) {
        console.log(e)
        res.send("E' successo qualcosa di strano..riprova!")
    }
})
app.post('/search', async (req, res) => {
    try {
        if (req.body.location !== undefined || req.body.search !== undefined) {
            let distance = 10000
            if (req.body.distance !== undefined) {
                distance = req.body.distance
            }
            let location = req.body.location
            if (req.body.search !== undefined) {
                let search
                if (process.env.MAPBOX_TOKEN === undefined) {
                    search = await axios.get('https://nominatim.openstreetmap.org/search?q=' + req.body.search + '&format=json')
                } else {
                    search = await axios.get('https://api.mapbox.com/geocoding/v5/mapbox.places/' + req.body.search + '.json?access_token=' + process.env.MAPBOX_TOKEN)
                }
                if (search.data !== undefined) {
                    res.send({ results: search.data })
                } else {
                    res.send({ message: "Nessun risultato!", error: true })
                }
            } else if (req.body.location !== undefined) {
                const markers = await searchNearLocation(req.body.location, distance)
                res.send({ location, markers })
            }
        } else {
            res.send({ message: "Malformed request", error: true })
        }
    } catch (e) {
        console.log(e)
        res.send("E' successo qualcosa di strano..riprova!")
    }
})

app.get('/whatsapp/webhook', getWebhook)
app.post('/whatsapp/webhook', processWebhook)
app.get('/secure', async (req, res) => {
    const secured = await secureDB();
    res.redirect(secured)
})

app.listen(port, () => {
    console.log('💥 MUNNIZZALAND-API SERVING THROUGH PORT 3000!')
})

// Securing DB on IPFS each 10 minutes
setInterval(() => {
    secureDB()
}, 1000 * 60 * 10)