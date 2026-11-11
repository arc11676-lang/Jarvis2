
from flask import Flask, request, jsonify, send_from_directory
import datetime
import os
import re
import json
import ast
import operator
from difflib import SequenceMatcher

app = Flask(__name__, static_folder=None)

FILES = {
    "index.html",
    "style.css",
    "script.js",
    "knowledge.js"
}

MEMORY_FILE = "jarvis_memory.json"

history = []

def load_memory():
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"name": "", "facts": {}}

memory = load_memory()

def save_memory():
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory, f, ensure_ascii=False, indent=2)

def normalize(text):
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())

def similarity(a, b):
    return SequenceMatcher(
        None, normalize(a), normalize(b)
    ).ratio()

def matches(text, phrases, threshold=0.70):
    for phrase in phrases:
        if phrase in text or similarity(text, phrase) >= threshold:
            return True
    return False

def calculate(expression):
    allowed = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.Mod: operator.mod,
        ast.USub: operator.neg
    }

    def solve(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value

        if isinstance(node, ast.BinOp) and type(node.op) in allowed:
            return allowed[type(node.op)](
                solve(node.left), solve(node.right)
            )

        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed:
            return allowed[type(node.op)](solve(node.operand))

        raise ValueError("Unsupported calculation")

    tree = ast.parse(expression, mode="eval")
    return solve(tree.body)

def remember_fact(text):
    match = re.match(
        r"(?:remember that|remember|save this|note that)\s+(.+)",
        text,
        re.I
    )

    if match:
        fact = match.group(1).strip()
        key = str(len(memory["facts"]) + 1)
        memory["facts"][key] = fact
        save_memory()
        return "I have saved that information in my memory."

    return None

def think(message):
    global history

    raw = message.strip()
    text = normalize(raw)

    if not text:
        return "Please tell me what you need."

    history.append(raw)
    history = history[-20:]

    # Greetings
    if matches(text, [
        "hello", "hi", "hey", "good morning",
        "good evening", "howdy"
    ]):
        return "Hello! JARVIS 9.0 is online. How can I assist you?"

    # Identity
    if matches(text, [
        "who are you", "what is your name",
        "tell me about yourself"
    ]):
        return "I am JARVIS 9.0, your local personal assistant."

    # Creator
    if matches(text, [
        "who created you", "who made you",
        "who built you"
    ]):
        return "I was created as a personal assistant project."

    # Name memory
    name_match = re.search(
        r"(?:my name is|call me)\s+(.+)",
        raw,
        re.I
    )

    if name_match:
        memory["name"] = name_match.group(1).strip()
        save_memory()
        return "It is nice to know you. I will remember your name."

    if matches(text, [
        "what is my name", "do you know my name",
        "who am i"
    ]):
        if memory["name"]:
            return "Your name is " + memory["name"] + "."
        return "You have not told me your name yet."

    # Save information
    result = remember_fact(raw)
    if result:
        return result

    # Recall information
    if matches(text, [
        "what do you remember", "show my memories",
        "what have i told you", "recall my facts"
    ]):
        facts = list(memory["facts"].values())

        if not facts:
            return "My memory is currently empty."

        return "Here is what I remember: " + ". ".join(facts)

    # Time
    if matches(text, [
        "what time is it", "tell me the time",
        "current time"
    ]):
        return "The current time is " + datetime.datetime.now().strftime("%I:%M %p")

    # Date
    if matches(text, [
        "what is today's date", "what date is it",
        "tell me the date", "today's date"
    ]):
        return "Today's date is " + datetime.date.today().strftime("%B %d, %Y")

    # Calculator
    calc_match = re.search(
        r"(?:calculate|compute|what is|solve)\s+"
        r"([-+*/().\d\s%]+)$",
        text
    )

    if calc_match:
        try:
            answer = calculate(calc_match.group(1))
            return "The answer is " + str(answer) + "."
        except:
            pass

    # Knowledge
    knowledge = {
        "artificial intelligence": "Artificial intelligence is technology that enables computers to perform tasks that normally require human intelligence.",
        "computer": "A computer is an electronic device that processes data and executes instructions.",
        "internet": "The internet is a worldwide network connecting computers and devices.",
        "javascript": "JavaScript is a programming language used to create interactive websites and applications.",
        "python": "Python is a versatile programming language known for its readable syntax.",
        "html": "HTML is the standard markup language used to structure web pages.",
        "css": "CSS controls the appearance and layout of web pages.",
        "earth": "Earth is the third planet from the Sun and the only known planet with life.",
        "moon": "The Moon is Earth's natural satellite.",
        "solar system": "Our solar system contains the Sun, eight planets, moons, asteroids and comets."
    }

    for topic, answer in knowledge.items():
        if topic in text or similarity(text, topic) > 0.82:
            return answer

    # Follow-up context
    if len(history) >= 2 and matches(text, [
        "explain more", "tell me more", "why",
        "how so", "continue", "give me details"
    ]):
        return "Let us explore the previous topic in more detail: " + history[-2]

    # Conversation
    if matches(text, [
        "how are you", "are you working",
        "are you online", "status report"
    ]):
        return "All systems are running. My local reasoning engine is ready."

    if matches(text, [
        "thank you", "thanks", "great job"
    ]):
        return "You are welcome. I am always ready to assist."

    if matches(text, [
        "goodbye", "bye", "see you"
    ]):
        return "Goodbye. JARVIS systems standing by."

    return (
        "I understand your message, but I need more context "
        "to give you an accurate answer. Could you rephrase "
        "the question or provide more details?"
    )

@app.route("/")
def home():
    return send_from_directory(app.root_path, "index.html")

@app.route("/<path:filename>")
def files(filename):
    if filename in FILES:
        return send_from_directory(app.root_path, filename)
    return "Not Found", 404

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"reply": "Please enter a message."}), 400

    try:
        reply = think(message)
        return jsonify({"reply": reply})
    except Exception as error:
        app.logger.exception("JARVIS brain error")
        return jsonify({
            "reply": "I encountered a processing error. Please try again."
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
