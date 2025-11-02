// index.js

import { GoogleGenAI } from "@google/genai";

document.addEventListener('DOMContentLoaded', () => {

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
  const folderInput = document.getElementById('folder-input');
  const fileDisplay = document.getElementById('file-display');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const removeFileButton = document.getElementById('remove-file-button');
  const uploadFileBtn = document.getElementById('upload-file-btn');
  const selectFolderBtn = document.getElementById('select-folder-btn');
  const promptForm = document.getElementById('prompt-form');
  const promptTextarea = document.getElementById('prompt-textarea');
  const generateButton = document.getElementById('generate-button');
  const resultContainer = document.getElementById('result-container');
  const resultDisplay = document.getElementById('result-display');

  // --- GEMINI API SETUP ---
  let ai;
  // Safely access the API key to prevent crashing in a browser-only environment
  const API_KEY = (typeof process !== 'undefined' && process.env && process.env.API_KEY)
    ? process.env.API_KEY
    : undefined;
  const DEMO_MODE = !API_KEY;

  if (!API_KEY) {
    // Don't set a hard error state — allow the UI to operate in demo mode so upload + submit can be tested.
    console.warn('No Google Gemini API key found. Running in demo mode. Generate will simulate a response.');
  } else {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  // --- UTILITY FUNCTIONS ---
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  // Convert a FileList or array of Files into a zip (base64) using JSZip
  const filesToZipBase64 = async (files) => {
    if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
    const zip = new JSZip();
    // files may be a FileList; normalize to array
    const fileArray = Array.from(files);
    for (const f of fileArray) {
      // Preserve relative path when available (webkitRelativePath)
      const path = f.webkitRelativePath || f.name;
      const buffer = await f.arrayBuffer();
      zip.file(path, buffer);
    }
    // generate as base64
    const base64 = await zip.generateAsync({ type: 'base64' });
    return base64;
  };

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
  // Allow the button to be enabled in demo mode (ai may be undefined). The submit handler will
  // handle demo-mode behavior if the real API client isn't initialized.
  const isButtonDisabled = !state.file || !state.prompt.trim() || state.generationState === GenerationState.LOADING;
    generateButton.disabled = isButtonDisabled;

    // Inline error display (below upload area)
    const errorEl = document.getElementById('error-msg');
    if (errorEl) {
      if (state.error) {
        errorEl.textContent = state.error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    }

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
  const handleFileSelect = async (eventOrFiles) => {
    try {
      let files;
      // Accept either an Event from an <input> change, a FileList, or a single File
      if (eventOrFiles instanceof Event) {
        files = eventOrFiles.target.files;
      } else if (eventOrFiles instanceof FileList || Array.isArray(eventOrFiles)) {
        files = eventOrFiles;
      } else if (eventOrFiles instanceof File) {
        files = [eventOrFiles];
      } else {
        files = null;
      }

      if (!files || files.length === 0) return;

      const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file limit

      // If multiple files were selected (folder selection), zip them client-side
      if (files.length > 1) {
        // validate per-file size
        for (const f of Array.from(files)) {
          if (f.size > MAX_SIZE) throw new Error(`One of the selected files is too large (max 10MB): ${f.name}`);
        }
        const base64 = await filesToZipBase64(files);
        // Derive folder name from first file's webkitRelativePath if available
        const first = files[0];
        const rel = first.webkitRelativePath || '';
        let folderName = 'archive';
        if (rel) folderName = rel.split('/')[0] || folderName;
        state.file = {
          name: `${folderName}.zip`,
          type: 'application/zip',
          size: 0,
          base64,
        };
      } else {
        const f = files[0];
        // If the user selected a zip file directly, just read it
        if (f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip') {
          const base64 = await fileToBase64(f);
          state.file = {
            name: f.name,
            type: 'application/zip',
            size: f.size,
            base64,
          };
        } else {
          // Single non-zip file - validate type and size
          const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
          if (f.size > MAX_SIZE) throw new Error('File is too large. Maximum size is 10MB.');
          if (!allowedTypes.includes(f.type)) throw new Error('Invalid file type. Please upload PDF, DOC, DOCX, or TXT, or upload a ZIP/folder.');
          const base64 = await fileToBase64(f);
          state.file = {
            name: f.name,
            type: f.type || 'application/octet-stream',
            size: f.size,
            base64,
          };
        }
      }

      // Reset per-request state (preserve initial API key warning in console)
      state.result = '';
      state.error = null;
      state.generationState = GenerationState.IDLE;
      render();
    } catch (error) {
      console.error('Error processing selection:', error);
      state.error = error instanceof Error ? error.message : 'Could not process the selected file(s).';
      state.file = null;
      state.generationState = GenerationState.ERROR;
      render();
    }
  };

  const handleFileRemove = () => {
    state.file = null;
    state.prompt = '';
    state.result = '';

    // Reset per-request state, but preserve the initial API key error if it exists.
    if (ai) {
      state.error = null;
      state.generationState = GenerationState.IDLE;
    }
    fileInput.value = ''; // Reset file input
    render();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Basic guards
    if (!state.file || !state.prompt) return;

    state.generationState = GenerationState.LOADING;
    state.result = '';
    state.error = null;
    render();
    try {
      // If AI client not initialized (no API key), run a demo/mock response so the button appears to work.
      if (!ai) {
        // Simulate processing time
        await new Promise((res) => setTimeout(res, 700));
        state.result = `Demo response:\nFile: ${state.file.name}\nPrompt: ${state.prompt}\n\n(This is a simulated response because no API key was provided.)`;
        state.generationState = GenerationState.SUCCESS;
        render();
        return;
      }

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
  // Folder input change (when user selects a folder via the dedicated control)
  folderInput?.addEventListener('change', (e) => {
    // Pass the FileList to the handler
    handleFileSelect(e.target.files);
  });
  // Wire visible buttons
  uploadFileBtn?.addEventListener('click', () => fileInput.click());
  selectFolderBtn?.addEventListener('click', () => folderInput?.click());
  removeFileButton.addEventListener('click', handleFileRemove);
  promptTextarea.addEventListener('input', (e) => {
    state.prompt = e.target.value;
    render();
  });
  promptForm.addEventListener('submit', handleSubmit);

  // Demo banner initialization and dismiss handler
  const demoBanner = document.getElementById('demo-banner');
  const dismissDemoBannerButton = document.getElementById('dismiss-demo-banner');
  try {
    if (demoBanner && DEMO_MODE && !localStorage.getItem('dismissDemoBanner')) {
      demoBanner.classList.remove('hidden');
    }
  } catch (e) {
    // Ignore localStorage errors in restricted environments
  }
  dismissDemoBannerButton?.addEventListener('click', () => {
    demoBanner?.classList.add('hidden');
    try { localStorage.setItem('dismissDemoBanner', '1'); } catch (e) {}
  });

  // Sample prompt chips handler (populate textarea when clicked)
  const samplePromptsEl = document.getElementById('sample-prompts');
  samplePromptsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('button.sample-prompt');
    if (!btn) return;
    const p = btn.dataset.prompt || '';
    state.prompt = p;
    promptTextarea.value = state.prompt;
    render();
  });

  // Initial render on page load
  render();

});
