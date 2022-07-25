import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
import fetch from 'node-fetch';

import { mongoose } from 'mongoose';
const uri = `mongodb://localhost:27017/sec-form4`;
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then((x) => {
    console.info(`connected to database: "${x.connections[0].name}"`)
}).catch((err) => {
    console.info('connecting to database: ', err.message);
});
const okrSchema = mongoose.Schema(
    {
        managerId: String,
        directId: String,
        objective: String,
        keyResult: String,
        due: Date,
    },
    {
        timestamps: true,
    },
);

const schema = mongoose.Schema(
    {
        "id": "String",
        "schemaVersion": {
            "type": "String"
        },
        "documentType": {
            "type": "Number"
        },
        "periodOfReport": {
            "type": "Date"
        },
        "notSubjectToSection16": {
            "type": "Number"
        },
        "issuer": {
            "issuerCik": {
                "type": "Number"
            },
            "issuerName": {
                "type": "String"
            },
            "issuerTradingSymbol": {
                "type": "String"
            }
        },
        "reportingOwner": {
            "reportingOwnerId": {
                "rptOwnerCik": {
                    "type": "Number"
                },
                "rptOwnerName": {
                    "type": "String"
                }
            },
            "reportingOwnerAddress": {
                "rptOwnerStreet1": {
                    "type": "String"
                },
                "rptOwnerStreet2": {
                    "type": "String"
                },
                "rptOwnerCity": {
                    "type": "String"
                },
                "rptOwnerState": {
                    "type": "String"
                },
                "rptOwnerZipCode": {
                    "type": "Number"
                },
                "rptOwnerStateDescription": {
                    "type": "String"
                }
            },
            "reportingOwnerRelationship": {
                "isDirector": {
                    "type": "Number"
                },
                "isOfficer": {
                    "type": "Number"
                },
                "isTenPercentOwner": {
                    "type": "Number"
                },
                "isOther": {
                    "type": "Number"
                },
                "officerTitle": {
                    "type": "String"
                },
                "otherText": {
                    "type": "String"
                }
            }
        },
        "nonDerivativeTable": {
            "nonDerivativeTransaction": {
                "type": [
                    "Mixed"
                ]
            }
        },
        "derivativeTable": {
            "derivativeTransaction": {
                "type": [
                    "Mixed"
                ]
            }
        },
        "footnotes": {
            "footnote": {
                "type": [
                    "Mixed"
                ]
            }
        },
        "ownerSignature": {
            "signatureName": {
                "type": "String"
            },
            "signatureDate": {
                "type": "Date"
            }
        }
    },
    {
        timeseries: {
            timeField: 'periodOfReport',
            metaField: 'reportingOwner',
            granularity: 'hours',
        },
    }
);
const Feed = mongoose.models.Feed || mongoose.model('Feed', schema);

async function store(managerId, objective, keyResult, due) {
    const doc = {
        managerId: managerId,
        objective: objective,
        keyResult: keyResult,
        due: due,
    };
    console.debug('createOkr: ', doc);
    return await OKR.create(doc);
};

function getDerivativeTransaction(t) {
    //  P is purchase and S is sell
    const generalCode = t.transactionCoding.transactionCode
    // D for disposed or A for acquired
    const action = t?.transactionAmounts?.transactionAcquiredDisposedCode?.value
    // number of shares disposed/acquired
    const shares = t?.transactionAmounts?.transactionShares?.value
    // price
    const priceRaw = t?.transactionAmounts?.transactionPricePerShare?.value
    const price = (priceRaw == null) ? -1 : priceRaw;
    // set prefix to -1 if derivatives were disposed. set prefix to 1 if derivatives were acquired.
    const prefix = (action == 'D') ? -1 : 1;
    // calculate transaction amount in $
    const amount = prefix * parseFloat(shares) * parseFloat(price)

    return ({
        generalCode,
        action,
        shares,
        price,
        amount
    })
}
async function parseEntries(url) {
    //TODO: refactor to use Promise.all instead
    const website = await fetch(url);
    const page = await website.text();

    const regex = /ACCESSION NUMBER:\s+(?<id>\d{10}-\d{2}-\d{6})/m;
    const found = page.match(regex);
    const id = found.groups.id;
    // console.log(found.groups.id); 
    // console.log(page)

    const i1 = page.indexOf("<XML>")
    const i2 = page.indexOf("</XML>", (i1 + 1))

    const txt = page.substring(i1, i2);
    const doc = parser.parse(txt).XML.ownershipDocument;
    // console.log(JSON.stringify(doc))
    const periodOfReport = doc?.periodOfReport;
    const rptOwnerName = doc?.reportingOwner?.reportingOwnerId?.rptOwnerName;
    const issuerTradingSymbol = doc?.issuer?.issuerTradingSymbol;
    const isOfficer = doc?.reportingOwner?.reportingOwnerRelationship?.isOfficer;

    const nonDerivativeTransactions = doc.nonDerivativeTable.nonDerivativeTransaction;

    // console.log('num:', nonDerivativeTransactions.length)
    // console.log({ _id: id, ...doc })

    const filter = { id };
    const update = { id, ...doc }
    const options = { upsert: true }
    const rep = await Feed.findOneAndUpdate(filter, update, options);
    // console.log(rep)


    if (Array.isArray(nonDerivativeTransactions)) {
        // console.log(nonDerivativeTransactions.length)
        for (const t of nonDerivativeTransactions) {
            // getDerivativeTransaction(t)
        }
    } else if (typeof nonDerivativeTransactions === 'object') {
        // console.log(1)
        // getDerivativeTransaction(nonDerivativeTransactions)
    } else {
        // console.log({
        //     url,
        //     issuerTradingSymbol,
        //     rptOwnerName,
        //     periodOfReport
        // })
        // throw new Error('nonDerivativeTransactions')
    }



    // break;
}
function parseFeed(feed) {
    let urls = []
    for (const item of feed) {
        const form = item.category.term;
        if (form !== '4') continue;
        // console.log({ title: item.title, url: item.link.href, form });
        const url = item.link.href.replace("-index.htm", ".txt");
        urls.push(url);
    }
    return urls;
}
async function getFeed() {
    const xml = await fetch('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=4&company=&dateb=&owner=include&start=0&count=100&output=atom')
    const feed = parser.parse(await xml.text());
    // console.log(feed)
    const entries = feed.feed.entry;
    return entries;
}
function everyMinute() { }
async function main() {
    const feed = await getFeed();
    // console.log(feed)
    const urls = parseFeed(feed);
    urls.forEach(url => parseEntries(url));
}
main()