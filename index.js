import { GoogleGenAI } from "@google/genai";

// --- STATE MANAGEMENT ---
const GenerationState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

let state = {
  file: null, // { name, type, size, base64 }
  prompt: '',
  result: '',
  error: null,
  generationState: GenerationState.IDLE,
};

// --- DOM ELEMENT REFERENCES ---
const uploadBox = document.getElementById('upload-box');
const fileInput = document.getElementById('file-input');
const fileDisplay = document.getElementById('file-display');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
const removeFileButton = document.getElementById('remove-file-button');
const promptForm = document.getElementById('prompt-form');
const promptTextarea = document.getElementById('prompt-textarea');
const generateButton = document.getElementById('generate-button');
const resultContainer = document.getElementById('result-container');
const resultDisplay = document.getElementById('result-display');

// --- GEMINI API SETUP ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  state.error = "Missing Google Gemini API Key. Please set the API_KEY environment variable.";
  render();
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- UTILITY FUNCTIONS ---
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// --- FILE UPLOAD HANDLERS ---
// Handle drag and drop
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.add('border-violet-500', 'bg-slate-800/50');
});

uploadBox.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.remove('border-violet-500', 'bg-slate-800/50');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.remove('border-violet-500', 'bg-slate-800/50');
  
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

// Handle click to upload
uploadBox.addEventListener('click', () => {
  fileInput.click();
});

// Handle file input change
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFileSelect(e);
});

// Handle file removal
removeFileButton.addEventListener('click', () => {
  state.file = null;
  fileInput.value = '';
  render();
});
const handleFileSelect = async (file) => {
  try {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.');
    }

    // Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_SIZE) {
      throw new Error('File is too large. Maximum size is 10MB.');
    }

    // Convert file to base64
    const base64 = await fileToBase64(file);

    // Update state
    state.file = {
      name: file.name,
      type: file.type,
      size: file.size,
      base64: base64
    };
    state.error = null;
  } catch (error) {
    state.error = error.message;
    state.file = null;
  }
  render();
};

// Handle file input change
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFileSelect(file);
});

// Handle drag and drop
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.add('border-violet-500', 'bg-slate-800/50');
});

uploadBox.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.remove('border-violet-500', 'bg-slate-800/50');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  uploadBox.classList.remove('border-violet-500', 'bg-slate-800/50');
  
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

// Handle click to upload
uploadBox.addEventListener('click', () => {
  fileInput.click();
});

// Handle file removal
removeFileButton.addEventListener('click', () => {
  state.file = null;
  fileInput.value = '';
  render();
});

// --- RENDER FUNCTION (UI Updater) ---
const render = () => {
  // File Upload UI
  if (state.file) {
    uploadBox.classList.add('hidden');
    fileDisplay.classList.remove('hidden');
    fileDisplay.classList.add('flex');
    fileNameEl.textContent = state.file.name;
    fileSizeEl.textContent = `${(state.file.size / 1024).toFixed(2)} KB`;
    promptTextarea.disabled = false;
  } else {
    uploadBox.classList.remove('hidden');
    fileDisplay.classList.add('hidden');
    fileDisplay.classList.remove('flex');
    promptTextarea.disabled = true;
  }

  // Prompt and Button UI
  promptTextarea.value = state.prompt;
  const isButtonDisabled = !state.file || !state.prompt.trim() || state.generationState === GenerationState.LOADING;
  generateButton.disabled = isButtonDisabled;

  if (state.generationState === GenerationState.LOADING) {
    generateButton.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Generating...
    `;
  } else {
    generateButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3z"></path>
        <path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path>
      </svg>
      Generate
    `;
  }
  
  // Result Display UI
  if (state.generationState === GenerationState.IDLE) {
    resultContainer.classList.add('hidden');
  } else {
    resultContainer.classList.remove('hidden');
    switch (state.generationState) {
      case GenerationState.LOADING:
        resultDisplay.innerHTML = `
          <div class="animate-pulse space-y-3">
            <div class="h-4 bg-slate-700 rounded w-3/4"></div>
            <div class="h-4 bg-slate-700 rounded"></div>
            <div class="h-4 bg-slate-700 rounded w-5/6"></div>
          </div>
        `;
        break;
      case GenerationState.ERROR:
        resultDisplay.innerHTML = `
          <div class="text-red-400">
            <h3 class="font-bold">An Error Occurred</h3>
            <p>${state.error || 'Something went wrong. Please try again.'}</p>
          </div>
        `;
        break;
      case GenerationState.SUCCESS:
        resultDisplay.innerHTML = `<div class="text-slate-300 whitespace-pre-wrap font-sans">${state.result}</div>`;
        break;
    }
  }
};

// --- EVENT HANDLERS ---
const handleFileSelect = async (fileOrEvent) => {
  const selectedFile = fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0];
  if (selectedFile) {
    try {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(selectedFile.type)) {
        throw new Error('Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.');
      }

      // Validate file size (10MB limit)
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (selectedFile.size > MAX_SIZE) {
        throw new Error('File is too large. Maximum size is 10MB.');
      }

      const base64 = await fileToBase64(selectedFile);
      state.file = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        base64,
      };
      state.result = '';
      state.error = null;
      state.generationState = GenerationState.IDLE;
      render();
    } catch (error) {
      console.error('Error converting file to base64:', error);
      state.error = 'Could not process the selected file.';
      state.generationState = GenerationState.ERROR;
      render();
    }
  }
};

const handleFileRemove = () => {
  state.file = null;
  state.prompt = '';
  state.result = '';
  state.error = null;
  state.generationState = GenerationState.IDLE;
  fileInput.value = ''; // Reset file input
  render();
};

const handleSubmit = async (event) => {
  event.preventDefault();
  if (!state.file || !state.prompt) return;

  state.generationState = GenerationState.LOADING;
  state.result = '';
  state.error = null;
  render();

  try {
    const documentPart = { inlineData: { mimeType: state.file.type, data: state.file.base64 } };
    const textPart = { text: state.prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [documentPart, textPart] },
    });
    
    state.result = response.text;
    state.generationState = GenerationState.SUCCESS;
  } catch (e) {
    console.error(e);
    state.error = e instanceof Error ? e.message : 'An unknown error occurred.';
    state.generationState = GenerationState.ERROR;
  }
  
  render();
};

// --- INITIALIZATION ---
uploadBox.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
removeFileButton.addEventListener('click', handleFileRemove);
promptTextarea.addEventListener('input', (e) => {
  state.prompt = e.target.value;
  render();
});
promptForm.addEventListener('submit', handleSubmit);

// Initial render on page load
render();
