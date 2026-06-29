import fs from 'fs';
import path from 'path';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

// Create the MCP Server
const server = new Server(
  {
    name: "rink-data-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper to scan public directory for JSON files
function getAvailableDatasets() {
    if (!fs.existsSync(PUBLIC_DIR)) return [];
    return fs.readdirSync(PUBLIC_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
}

// Load dataset into memory
function loadDataset(name) {
    const filePath = path.join(PUBLIC_DIR, `${name}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Flatten multi-tab data into a single array for searching
        if (Array.isArray(data)) return data;
        let flat = [];
        for (const key of Object.keys(data)) {
            if (Array.isArray(data[key])) flat.push(...data[key]);
        }
        return flat;
    } catch (e) {
        return null;
    }
}

// Register Tools Dynamically based on available datasets
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const datasets = getAvailableDatasets();
    const tools = [];

    for (const dataset of datasets) {
        tools.push({
            name: `search_${dataset}`,
            description: `Search the ${dataset} database for specific keywords, locations, or names. Returns up to 10 matching records.`,
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query (e.g., 'Microscope', 'Kerala', or a specific ID)"
                    }
                },
                required: ["query"]
            }
        });
    }

    return { tools };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name.startsWith('search_')) {
        const datasetName = name.replace('search_', '');
        const query = args?.query?.toLowerCase() || '';

        if (!query) {
            return { content: [{ type: "text", text: "Error: A query string is required." }], isError: true };
        }

        const data = loadDataset(datasetName);
        if (!data) {
            return { content: [{ type: "text", text: `Error: Dataset ${datasetName} could not be loaded.` }], isError: true };
        }

        // Deep search across all keys in the objects
        const results = data.filter(item => {
            for (const key of Object.keys(item)) {
                if (String(item[key]).toLowerCase().includes(query)) {
                    return true;
                }
            }
            return false;
        }).slice(0, 10); // Limit to 10 to save tokens

        if (results.length === 0) {
            return {
                content: [{ type: "text", text: `No results found in ${datasetName} for query: '${query}'` }]
            };
        }

        return {
            content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
        };
    }

    return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
    };
});

// Start the server via Stdio transport
async function main() {
    console.error("Starting RINK Data MCP Server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("RINK Data MCP Server is running and listening on Stdio.");
}

main().catch((error) => {
    console.error("Fatal error starting MCP Server:", error);
    process.exit(1);
});
