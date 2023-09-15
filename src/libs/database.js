import mongoose from 'mongoose'

export const reportSchema = new mongoose.Schema({
    photo: String,
    from: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    timestamp: Number,
    approved: Boolean,
    evalued: Boolean,
    source: String
});

export const adminSchema = new mongoose.Schema({
    username: String,
    approved: Boolean,
    whatsapp_phone_number: Number,
    whatsapp_user: Number,
    chatId: String
});

export const searchNearLocation = (location, distance) => {
    return new Promise(async response => {
        try {
            const reports = mongoose.model('report', reportSchema);
            const allReports = await reports.find({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: location
                        },
                        $maxDistance: distance,
                        $minDistance: 0
                    }
                },
                approved: true
            }).sort({ timestamp: -1 })
            let nearReports = []
            for (let k in allReports) {
                const report = allReports[k]
                nearReports.push({
                    photo: report.photo,
                    location: report.location,
                    timestamp: report.timestamp,
                    source: report.source
                })
            }
            response(nearReports)
        } catch (e) {
            console.log(e)
            response(false)
        }
    })
}

export const returnAllMarkers = () => {
    return new Promise(async response => {
        try {
            const reportModel = mongoose.model('report', reportSchema);
            const reports = await reportModel.find({ approved: true })
            let parsed = []
            for (let k in reports) {
                parsed.push({
                    photo: reports[k].photo,
                    location: reports[k].location,
                    timestamp: reports[k].timestamp,
                    source: reports[k].source
                })
            }
            response(parsed)
        } catch (e) {
            response(false)
        }
    })
}