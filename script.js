
// ============================================
// JARVIS BRAIN 9.0
// ADVANCED LOCAL PERSONAL ASSISTANT
// VOICE & RESPONSE EDITION
// ============================================

const micButton = document.getElementById("micButton");
const sendButton = document.getElementById("sendButton");
const userInput = document.getElementById("userInput");
const chatBox = document.getElementById("chatBox");
const state = document.getElementById("state");

const MEMORY_KEY = "JARVIS_BRAIN_5_MEMORY";

let busy = false;
let recognition = null;
let listening = false;
let jarvisVoice = null;

let memory = {
    name: "",
    facts: [],
    tasks: [],
    history: [],
    lastQuestion: ""
};

// ============================================
// MEMORY
// ============================================

function loadMemory() {
    try {
        const saved = JSON.parse(localStorage.getItem(MEMORY_KEY));

        if (saved && typeof saved === "object") {
            memory = {
                ...memory,
                ...saved,
                facts: Array.isArray(saved.facts) ? saved.facts : [],
                tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
                history: Array.isArray(saved.history) ? saved.history : []
            };
        }
    } catch (error) {
        console.warn("Memory loading error:", error);
    }
}

function saveMemory() {
    try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    } catch (error) {
        console.warn("Memory saving error:", error);
    }
}

// ============================================
// INTERFACE
// ============================================

function setState(message) {
    if (state) state.textContent = message;
}

function addMessage(name, message, type = "") {
    if (!chatBox) return;

    const div = document.createElement("div");
    div.className = "message " + type;

    const title = document.createElement("strong");
    title.textContent = name;

    const content = document.createElement("div");
    content.textContent = String(message);

    div.appendChild(title);
    div.appendChild(content);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ============================================
// JARVIS VOICE
// ============================================

function selectJarvisVoice() {
    if (!("speechSynthesis" in window)) return;

    const voices = speechSynthesis.getVoices();

    if (!voices.length) return;

    const british = voices.filter(v =>
        v.lang && v.lang.toLowerCase().startsWith("en-gb")
    );

    const preferredNames = [
        "daniel",
        "arthur",
        "oliver",
        "george",
        "ryan"
    ];

    jarvisVoice =
        british.find(v =>
            preferredNames.some(name =>
                v.name.toLowerCase().includes(name)
            )
        ) ||
        british[0] ||
        voices.find(v => v.lang && v.lang.startsWith("en-US")) ||
        voices.find(v => v.lang && v.lang.startsWith("en"));
}

if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = selectJarvisVoice;
    selectJarvisVoice();
}

function speak(message) {
    if (!("speechSynthesis" in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
        String(message)
    );

    if (jarvisVoice) {
        utterance.voice = jarvisVoice;
        utterance.lang = jarvisVoice.lang;
    } else {
        utterance.lang = "en-GB";
    }

    utterance.rate = 1.03;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    utterance.onstart = () => setState("JARVIS SPEAKING");

    utterance.onend = () => setState("SYSTEM READY");

    utterance.onerror = () => setState("VOICE ERROR");

    speechSynthesis.speak(utterance);
}

// ============================================
// CALCULATOR
// ============================================

function calculate(expression) {
    try {
        const clean = expression.replace(
            /[^0-9+\-*/().%\s]/g,
            ""
        );

        if (!clean || !/[0-9]/.test(clean)) {
            return null;
        }

        const tokens = clean.match(
            /\d+(?:\.\d+)?|[()+\-*/%]/g
        );

        if (!tokens || tokens.join("") !== clean.replace(/\s/g, "")) {
            return null;
        }

        let index = 0;

        function factor() {
            const token = tokens[index++];

            if (token === "+") return factor();
            if (token === "-") return -factor();

            if (token === "(") {
                const value = expressionValue();

                if (tokens[index++] !== ")") {
                    throw new Error("Missing parenthesis");
                }

                return value;
            }

            const number = Number(token);

            if (!Number.isFinite(number)) {
                throw new Error("Invalid number");
            }

            return number;
        }

        function term() {
            let value = factor();

            while (
                tokens[index] === "*" ||
                tokens[index] === "/" ||
                tokens[index] === "%"
            ) {
                const operator = tokens[index++];
                const right = factor();

                if (operator === "*") value *= right;
                if (operator === "/") value /= right;
                if (operator === "%") value %= right;
            }

            return value;
        }

        function expressionValue() {
            let value = term();

            while (
                tokens[index] === "+" ||
                tokens[index] === "-"
            ) {
                const operator = tokens[index++];
                const right = term();

                value = operator === "+"
                    ? value + right
                    : value - right;
            }

            return value;
        }

        const result = expressionValue();

        if (index !== tokens.length || !Number.isFinite(result)) {
            return null;
        }

        return result;
    } catch {
        return null;
    }
}

// ============================================
// PERSONAL MEMORY
// ============================================

function rememberFact(fact) {
    if (!fact) return;

    memory.facts.push(fact);

    if (memory.facts.length > 100) {
        memory.facts.shift();
    }

    saveMemory();
}

function recallMemory() {
    if (!memory.facts.length) {
        return "I do not have any saved facts yet.";
    }

    return "Here is what I remember:\n" +
        memory.facts.map((fact, i) =>
            `${i + 1}. ${fact}`
        ).join("\n");
}

// ============================================
// TASK MANAGER
// ============================================

function addTask(task) {
    memory.tasks.push({
        text: task,
        done: false,
        created: new Date().toISOString()
    });

    saveMemory();

    return "Task added successfully.";
}

function listTasks() {
    if (!memory.tasks.length) {
        return "You have no tasks.";
    }

    return memory.tasks.map((task, i) =>
        `${i + 1}. ${task.done ? "[DONE]" : "[PENDING]"} ${task.text}`
    ).join("\n");
}

function completeTask(number) {
    const index = Number(number) - 1;

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= memory.tasks.length
    ) {
        return "Task not found.";
    }

    memory.tasks[index].done = true;
    saveMemory();

    return "Task completed.";
}

// ============================================
// KNOWLEDGE SEARCH
// ============================================

function searchKnowledge(command) {
    const database = window.JARVIS_KNOWLEDGE || [];

    const query = command.toLowerCase();

    const results = database.filter(item => {
        const text = (
            String(item.title || "") + " " +
            String(item.content || "") + " " +
            String(item.keywords || "")
        ).toLowerCase();

        return text.includes(query);
    });

    if (!results.length) return null;

    return results.slice(0, 3).map(item =>
        `${item.title || "Information"}: ${item.content || ""}`
    ).join("\n\n");
}

// ============================================
// LOCAL THINKING ENGINE
// ============================================

function normalizeCommand(text) {
    return text.toLowerCase().trim();
}

function think(text) {
    const command = normalizeCommand(text);

    // Greetings
    if (/^(hello|hi|hey|good morning|good evening)\b/i.test(command)) {
        return "Good day. JARVIS systems are online. How may I assist you?";
    }

    // Identity
    if (/who are you|your name|introduce yourself/.test(command)) {
        return "I am JARVIS, your personal digital assistant. All local systems are ready.";
    }

    // Name
    if (/my name is\s+/i.test(text)) {
        memory.name = text.replace(/.*my name is\s+/i, "").trim();
        saveMemory();

        return `Understood. I will call you ${memory.name}.`;
    }

    if (/what is my name|do you know my name/.test(command)) {
        return memory.name
            ? `Your name is ${memory.name}.`
            : "You have not told me your name yet.";
    }

    // Remember
    if (/^remember that\s+/i.test(text)) {
        const fact = text.replace(/^remember that\s+/i, "");
        rememberFact(fact);

        return "Information saved successfully.";
    }

    if (/what do you remember|recall memory|show memory/.test(command)) {
        return recallMemory();
    }

    if (/clear saved facts/.test(command)) {
        memory.facts = [];
        saveMemory();

        return "Saved facts have been cleared.";
    }

    // Previous question
    if (/what did i ask before|previous question/.test(command)) {
        return memory.lastQuestion
            ? `Your previous question was: ${memory.lastQuestion}`
            : "There is no previous question.";
    }

    // Calculator
    if (/^(calculate|compute|what is)\s+/i.test(text)) {
        const expression = text
            .replace(/^(calculate|compute|what is)\s+/i, "")
            .replace(/=/g, "");

        const result = calculate(expression);

        if (result !== null) {
            return `The result is ${result}.`;
        }
    }

    // Tasks
    if (/^add task\s+/i.test(text)) {
        return addTask(text.replace(/^add task\s+/i, ""));
    }

    if (/show tasks|list tasks|my tasks/.test(command)) {
        return listTasks();
    }

    const completeMatch = command.match(/^complete task\s+(\d+)$/);

    if (completeMatch) {
        return completeTask(completeMatch[1]);
    }

    // Time
    if (/what time|current time/.test(command)) {
        return "The current time is " +
            new Date().toLocaleTimeString();
    }

    // Date
    if (/what date|today's date|current date/.test(command)) {
        return "Today's date is " +
            new Date().toLocaleDateString();
    }

    // Knowledge
    const knowledge = searchKnowledge(command);

    if (knowledge) return knowledge;

    // Help
    if (/^help$|what can you do/.test(command)) {
        return [
            "I can:",
            "Remember facts",
            "Recall saved information",
            "Calculate expressions",
            "Manage tasks",
            "Tell the time and date",
            "Search my local knowledge database",
            "Respond using speech"
        ].join("\n");
    }

    if (/thank you|thanks/.test(command)) {
        return "You are welcome. Always ready to assist.";
    }

    if (/goodbye|see you|bye/.test(command)) {
        return "Until next time. JARVIS standing by.";
    }

    return "I understand your message, but my local knowledge is limited. Please try a different question or add information to my knowledge database.";
}

// ============================================
// HISTORY
// ============================================

function saveHistory(role, message) {
    memory.history.push({
        role,
        text: message,
        time: new Date().toISOString()
    });

    if (memory.history.length > 100) {
        memory.history = memory.history.slice(-100);
    }

    saveMemory();
}

// ============================================
// MESSAGE PROCESSOR
// ============================================

async function processMessage(text) {
    if (!text || !text.trim() || busy) return;

    const cleanText = text.trim();

    busy = true;

    if (sendButton) sendButton.disabled = true;

    addMessage("YOU", cleanText, "user-message");
    saveHistory("user", cleanText);

    if (userInput) userInput.value = "";

    setState("JARVIS THINKING");

    let answer = "";

    try {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            12000
        );

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: cleanText
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error("Server error: " + response.status);
            }

            const data = await response.json();

            answer =
                data.reply ||
                data.response ||
                data.answer ||
                "";

        } finally {
            clearTimeout(timeout);
        }

        if (!answer) {
            answer = think(cleanText);
        }

    } catch (error) {
        console.warn("Server unavailable:", error);
        answer = think(cleanText);
    }

    memory.lastQuestion = cleanText;

    addMessage("JARVIS", answer, "jarvis-message");
    saveHistory("assistant", answer);

    speak(answer);

    busy = false;

    if (sendButton) sendButton.disabled = false;

    if (userInput) userInput.focus();

    setState("SYSTEM READY");
}

// ============================================
// SEND BUTTON
// ============================================

if (sendButton) {
    sendButton.addEventListener("click", () => {
        processMessage(userInput.value);
    });
}

// ============================================
// ENTER KEY
// ============================================

if (userInput) {
    userInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            processMessage(userInput.value);
        }
    });
}

// ============================================
// SPEECH RECOGNITION
// ============================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();

    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        listening = true;
        setState("LISTENING...");
    };

    recognition.onresult = event => {
        const transcript =
            event.results[0][0].transcript;

        if (userInput) {
            userInput.value = transcript;
        }

        processMessage(transcript);
    };

    recognition.onerror = event => {
        setState("MICROPHONE ERROR: " + event.error);
        listening = false;
    };

    recognition.onend = () => {
        listening = false;

        if (!busy) setState("SYSTEM READY");
    };

} else {
    console.warn("Speech recognition is not supported.");
}

// ============================================
// MICROPHONE BUTTON
// ============================================

if (micButton) {
    micButton.addEventListener("click", () => {
        if (!recognition) {
            setState("SPEECH RECOGNITION NOT SUPPORTED");
            return;
        }

        if (listening) {
            recognition.stop();
        } else {
            try {
                selectJarvisVoice();
                recognition.start();
            } catch (error) {
                console.warn(error);
                setState("MICROPHONE ERROR");
            }
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

function initializeJarvis() {
    loadMemory();
    selectJarvisVoice();

    setState("SYSTEM READY");

    console.log("JARVIS BRAIN 9.0 ONLINE");
}

initializeJarvis();
