import { marked } from 'marked';

const text = "Next-Generation Starter Culture for Kerala's Traditional Fermented Food";
console.log("Regex match:", /[\*\_\-\[\]\n]/.test(text));
console.log("Marked output:", marked.parseInline(text));
