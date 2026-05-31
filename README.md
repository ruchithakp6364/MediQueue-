# MediQueue

An AI-powered smart patient triage and real-time hospital queue prioritization system. 

## The Core Concept
Traditional hospital triage systems often suffer from manual bottlenecks, long wait times, and delayed care for moderate-to-severe symptoms. MediQueue solves this by integrating intelligent AI symptom analysis with real-time dynamic queue scheduling. 

> **Why MediQueue is Unique:**
> "Unlike symptom checker apps, MediQueue combines AI triage with real-time hospital queue prioritization."

---

## 🧠 AI Decision Flow

When a patient interacts with the platform, their clinical journey is managed through a sophisticated, real-time decision loop:

1. **User Symptom Input**  
   The patient enters their current symptoms, medical history notes, and discomfort levels into the intuitive patient dashboard.

2. **Gemini Severe-Risk Analysis**  
   The system utilizes server-side Gemini AI models to parse the natural language input, identify potential clinical risk factors, and determine the clinical severity level.

3. **Dynamic Severity Mapping**  
   Based on the AI clinical assessment, cases are triaged into three main categories:
   * 🚨 **Critical:** Generates an immediate alert interface, advising urgent emergency room procedures and direct emergency routing.
   * ⚠️ **Moderate:** Places the patient into a **priority queue**, bumping them ahead of standard appointments because of their urgent medical needs.
   * ✅ **Low:** Provides tailored, safe self-care guidance and adds them to the standard general-care queue.

4. **Dynamic Queue Location Positioning**  
   The system automatically calculates the patient's queue position in real-time, taking into strictly accounted variables such as AI-prioritized severity scores, current queue lengths, and active doctor availability.

---

## Technical Architecture
* **Frontend:** React 18 with Vite, styled elegantly using Tailwind CSS.
* **Database & Auth:** Google Firebase (Cloud Firestore & Authentication) facilitating secure real-time listener synchronization and robust access rules.
* **AI Engine:** Google Gemini API Integration for server-side clinical evaluation.
