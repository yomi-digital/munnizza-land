import dotenv from 'dotenv'
import { Readable } from 'stream'
import axios from 'axios'
import FormData from 'form-data'
import mongoose from 'mongoose'
import { reportSchema } from './database.js'
dotenv.config()

export function uploadFileOnPinata(content, filename) {
    return new Promise(async response => {
        if (process.env.PINATA_JWT !== undefined) {
            try {
                console.log('🔼 Uploading ' + filename + '..')
                const stream = Readable.from(content);
                const formData = new FormData();
                formData.append("file", stream, { filename: filename });
                formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }))
                formData.append("pinataMetadata", JSON.stringify({ name: "[UMi] " + filename }))
                const uploaded = await axios.post(
                    "https://api.pinata.cloud/pinning/pinFileToIPFS",
                    formData,
                    {
                        maxBodyLength: 'Infinity',
                        headers: {
                            "Content-Type": "multipart/form-data; boundary=" + formData._boundary,
                            "Authorization": "Bearer " + process.env.PINATA_JWT
                        },
                    }
                )
                if (uploaded.data.IpfsHash !== undefined) {
                    response(uploaded.data.IpfsHash)
                } else {
                    response(false)
                }
            } catch (e) {
                console.log('😵 Pinata upload failed')
                console.log(e.message)
                console.log("--------------------")
                response(false)
            }
        } else {
            console.log('😵 Pinata is not configured.')
            response(false)
        }
    })
}

export function secureDB() {
    return new Promise(async response => {
        try {
            const reports = mongoose.model('report', reportSchema);
            const allReports = await reports.find({ approved: true }).sort({ timestamp: -1 })
            console.log('🔒 SECURING DATABASE..')
            let toSecure = []
            // Removing useless data
            for (let k in allReports) {
                toSecure.push({
                    photo: allReports[k].photo,
                    location: allReports[k].location,
                    timestamp: allReports[k].timestamp,
                    approved: allReports[k].approved,
                })
            }
            const db = JSON.stringify(toSecure, null, 4)
            const dbHash = await uploadFileOnPinata(db, 'munnizzaland_' + new Date().getTime() + '.json')
            if (dbHash !== false) {
                console.log('🔒 DATABASE SECURED AT:', dbHash)
                response(process.env.PINATA_ENDPOINT + '/ipfs/' + dbHash)
            } else {
                console.log('🔒 DATABASE SECURED FAILED')
                response(false)
            }
        } catch (e) {
            console.log('🔒 DATABASE SECURED FAILED')
            response(false)
        }
    })
}