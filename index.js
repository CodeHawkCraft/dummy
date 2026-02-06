import axios from 'axios';
import fs from 'fs';
import { Ollama } from 'ollama'
import dotenv from 'dotenv';
import nodeCron from 'node-cron';
import { GoogleGenAI } from "@google/genai";

dotenv.config();
const apiKey = process.env.OLLAMA_API_KEY?.trim();
if (!apiKey) {
  throw new Error('OLLAMA_API_KEY is not set in environment variables');
}

const ollama = new Ollama({
  host: 'https://ollama.com',
  headers: { 
    Authorization: `Bearer ${apiKey}` 
  },
})

const groundingTool = {
    googleSearch: {},
  };

const config = {
    tools: [groundingTool],
  };


  async function promptGenerator() {
    // const companies = await fetchExternalCompaniesFromDb();
  
    // const existingCompanies = companies.map((company) => ({
    //   company_name: company.companyName,
    //   registered_name: company.companyRegisteredName,
    // }));
  
    const existingCompanies = [];
    const prompt = `
  You are generating a list of companies that use Greenhouse or Lever for job postings.
  
  Output Rules:
  - Return ONLY valid JSON
  - Do NOT include explanations, comments, or markdown
  - Do NOT include trailing commas
  - Return an array of objects
  - Each object must follow this exact schema:
  
  [
    {
      "company_name": "Public-facing company name",
      "registered_name": "greenhouse-board-identifier"
    }
  ]
  
  Existing Companies (DO NOT include any of these):
  ${JSON.stringify(existingCompanies)}
  
  Constraints:
  - Generate as MANY companies as possible
  - All companies must be:
    - US-based
    - Healthcare-related (hospitals, health systems, clinics, health tech, biotech, pharma, diagnostics, care providers, etc.)
    - Actively using Greenhouse or Lever
  - Each company must be UNIQUE
  - Do NOT return any company whose company_name OR registered_name already exists in the list above
  - registered_name must match the Greenhouse job board identifier format (used in Greenhouse URLs)
  
  Return only the JSON array.
  `;
  
    return prompt;
  }
async function fetchCompaniesUsingOllama(){

    const prompt = await promptGenerator();
    const response = await ollama.chat({
        model: "gpt-oss:20b",
        messages: [
            {
                role: "system",
                content: prompt
            }
        ],
        options: {
            tools: [{ type: 'webSearch' }]
        }
    })

    return JSON.parse(response.message.content);
}

  


async function fetchCompaniesUsingGoogleGenAI(){
    const genai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY?.trim(),
    })
    const prompt = await promptGenerator();
    const response = await genai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config,
    })
    const cleanText = response.text.replace(/```json\n|```/g, '').trim();
    return JSON.parse(cleanText);
}

async function getValidGreenhouseCompanies(companies) {
    const companiesList = [];
    await Promise.all(
      companies.map(async (companyName) => {
        try {
          const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${companyName}/jobs`;
          await axios.get(apiUrl);
          companiesList.push(companyName);
        } catch (err) {
          // Silently skip companies that fail validation
        //   console.error("Error inside getValidGreenhouseCompanies", err.message);
        }
      }),
    );
    return companiesList;
  }

// Function to append data to companies.json without deleting existing data








let totalFetchedCount=0;

async function checkCompaniesInLevel(companies){
    const companiesList = [];
    await Promise.all(
      companies.map(async (companyName) => {
        try {
            console.log("checking company ----> ",companyName);
          const apiUrl = `https://api.lever.co/v0/postings/${companyName}?mode=json`;
          await axios.get(apiUrl);
          companiesList.push(companyName);
        } catch (err) {
          // Silently skip companies that fail validation
        //   console.error("Error inside getValidGreenhouseCompanies", err.message);
        }
      }),
    );
    return companiesList;
}

function categorizeCompanies(greenhouseCompanies, leverCompanies) {
    const companiesExistOnBothPlatforms = greenhouseCompanies.length > leverCompanies.length 
        ? greenhouseCompanies.filter(company => leverCompanies.includes(company)) 
        : leverCompanies.filter(company => greenhouseCompanies.includes(company));
    
    const companiesExistOnOnlyGreenhouse = greenhouseCompanies.filter(company => !leverCompanies.includes(company));
    const companiesExistOnOnlyLever = leverCompanies.filter(company => !greenhouseCompanies.includes(company));
    
    return {
        both: companiesExistOnBothPlatforms,
        onlyGreenhouse: companiesExistOnOnlyGreenhouse,
        onlyLever: companiesExistOnOnlyLever
    };
}

async function main(){
    try {
        const companiesUsingGoogleGenAI = await fetchCompaniesUsingGoogleGenAI();
        const companiesUsingOllama = await fetchCompaniesUsingOllama();
        console.log("companies length using google gen ai ----> ",companiesUsingGoogleGenAI.length);
        console.log("companies length using ollama ----> ",companiesUsingOllama.length);
        const companies = [...companiesUsingGoogleGenAI, ...companiesUsingOllama];
        totalFetchedCount+=companies.length;

        const validateGreenhouseCompanies = await getValidGreenhouseCompanies(companies.map(company => company.company_name));
        const validateLeverCompanies = await checkCompaniesInLevel(companies.map(company => company.company_name));

        const uniqueGreenhouseCompanies = [...new Set(validateGreenhouseCompanies)];
        const uniqueLeverCompanies = [...new Set(validateLeverCompanies)];

        const categorizedCompanies = categorizeCompanies(validateGreenhouseCompanies, validateLeverCompanies);

        console.log("companies exist on both platforms ----> ",categorizedCompanies.both.length);
        console.log("companies exist on only greenhouse ----> ",categorizedCompanies.onlyGreenhouse.length);
        console.log("companies exist on only lever ----> ",categorizedCompanies.onlyLever.length);
        
        // green house exist companies stored in a file
        fs.writeFileSync('greenhouse.txt', uniqueGreenhouseCompanies.join('\n'));
        // lever exist companies stored in a file
        fs.writeFileSync('lever.txt', uniqueLeverCompanies.join('\n'));
        // both exist companies stored in a file
        fs.writeFileSync('both.txt', categorizedCompanies.both.join('\n'));
      
    } catch (error) {
        console.error("Error inside main file", error);
    }
}

// main();


let count=1;
// run every 60s to fetch the new companies
nodeCron.schedule('*/60 * * * * *', async () => {
    console.log("fetching times ", count," total fetched count", totalFetchedCount);
    count++;
    await main();
    console.log("-----------------------------------------------")
});



