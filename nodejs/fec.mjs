import parse from 'html-dom-parser';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const url = "https://docquery.fec.gov/cgi-bin/forms/C00213512/"
const page = await fetch(`${url}`);
const source = await page.text();

const $ = cheerio.load(source);
console.log($(".tablebody"))

// import { XMLParser } from 'fast-xml-parser';
// const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
// import fetch from 'node-fetch';

// const xml = await fetch('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=4&company=&dateb=&owner=include&start=0&count=100&output=atom')
// const feed = parser.parse(await xml.text());
// const entries = feed.feed.entry
// for (const item of entries) {
//     const form = item.category.term;
//     if (form !== '4') continue;
//     console.log({ title: item.title, url: item.link.href, form });

//     // https://www.sec.gov/Archives/edgar/data/922621/000112760222019650/0001127602-22-019650-index.htm
//     // https://www.sec.gov/Archives/edgar/data/922621/000112760222019650/form4.xml

//     break;
// }