# User Journey

# 🏋️ Circuit

## 1. Overview

Circuit Training is the trainer-led, multi-round workout flow designed for semi-private group sessions.

The flow begins with trainer check-in and ends with workouts broadcast live on the TV app.

**Purpose:**

- Allow trainers to quickly configure circuits (rounds, time, exercises per round).
- Leverage AI to generate balanced routines from the exercise library.
- Keep trainers in control through preview + editing.
- Ensure seamless broadcast to the TV app with realtime sync.

---

## Step-by-Step

### Step 1: Trainer Check-In

- Trainer texts **"here"** from their phone.
- System matches phone number → trainer profile → business.
- Trainer is placed in the **session lobby**.

### Step 2: Circuit Configuration

- On the mobile web app, trainer opens the **Circuit Config page**.
- Configuration fields available:
    - **# of rounds**
    - **Work duration (seconds)**
    - **Rest duration (seconds)**
    - **# of exercises per round**

### Step 3: AI Workout Generation

- Configurations are passed into the **LLM (GPT-5 powered)**.
- LLM applies **simple movement pattern variety constraints** to assemble the workout.
- Exercises are pulled from the app's **exercise library**.

### Step 4: Preview + Editing

- Trainer receives a **preview table** showing:
    - Exercises organized into rounds
    - Work/rest timing per station
- Available trainer edits:
    - **Swap exercise**
    - **Re-order exercise within a round**
- Changes update the workout plan in real time.

### Step 5: Broadcast to TV

- Once trainer finalizes the plan, the workout is **broadcast live to the React Native TV app**.
- Clients see the finalized rounds and exercises displayed in sequence.

---

# 💪 Strength

## 1. Overview

Strength Training is the **client-personalized flow** where each participant receives a tailored workout plan.

The journey begins with client check-in and preference capture, passes through deterministic + AI logic, and ends with a shared TV display plus individual feedback loops.

**Purpose:**

- Give each client ownership over their workout (preferences + swaps).
- Ensure balanced distribution of exercises across group sessions.
- Has two phases of LLM calls
    1. Workout generation
    2. Workout organization
- Each phase follows the same pattern of deterministic rules first → then apply AI personalization and creativity.
- Create a continuous improvement loop via feedback → scoring system → future sessions.

---

## 2. User Journey (Step-by-Step)

### Step 1: Client Check-In (SMS)

- Client texts **"here"** from their phone.
- System matches phone number → client profile → business.
- Client is placed in the **session lobby**.

### Step 2: Session Start

- Trainer starts the session from the **TV app**.
- This triggers the next step where clients receive their preferences link.

### Step 3: Workout Preferences Link

- After trainer starts the session, client receives a **text message with a mobile web app link**.
- Link opens the **Workout Preferences page**.
- Clients can skip preferences and use defaults.

### Step 4: Workout Preferences + History Modal

- On the preferences page, clients customize:
    - **# of exercises**
    - **Workout type**:
        - **Full Body**: Balanced workout covering all major muscle groups with exercises from each movement pattern (squat, hinge, lunge, push, pull, core). Ensures comprehensive training with upper/lower body balance.
        - **Targeted**: Focused workout concentrating on 2-4 specific muscle groups selected by the client. Allows for specialized training of particular areas while maintaining exercise variety.
    - **Muscles to focus on**
    - **Muscles to limit**
    - **Include/exclude core**
- The **'Targets to Hit'** button opens a modal showing **personal exercise history**:
    - Muscle coverage from previous sessions
    - Time range options (This Week, 7d, 14d, 30d)
    - Visual indicators for muscles worked

### Step 5: AI Workout Generation (Client-Specific)

- **Inputs:**
    - Client profile (scoring system)
    - Pre-assignment logic (1-3 exercises):
        - Exercise #1: Highest-scored favorite exercise
        - Exercise #2: Shared exercise from pool (coordinated across clients)
        - Exercise #3: Core exercise (if client selected "with core")
- **LLM Output:**
    - A completed, customized workout for each client.
    - Runs concurrently across all clients in the session.

### Step 6: Client Preview + Edit

- Clients see a **preview of their workout** in the mobile web app.
- Edit capabilities:
    - **Swap exercise** (unlimited swaps allowed)
    - Smart recommendations shown based on muscle groups
    - Can swap exercises until workout starts

### Step 7: TV Workout Organization

- **First applies a deterministic Logic Layer (pre-processing)**
    - Applies equipment conflict rules
    - Handles shared stations
    - Enforces singleton constraints
- TV then triggers a **second LLM call**:
    - Organizes all client workouts into a unified session structure
    - Creates rounds with creative names
    - Coordinates shared exercises (shown by multiple clients having same exercise)

### Step 8: TV Broadcast

- Workout is broadcast live on the **React Native TV app**.
- TV displays:
    - Exercises per round
    - Each client's assignments with colored chips
    - Weight markers showing last logged weight (from previous feedback)
    - Personal Record (PR) indicators (🏆)

### Step 9: Post-Workout Feedback

- Clients receive a **post-session SMS** with a feedback form.
- Feedback options:
    - **Like** / **Dislike** / **Not Sure** (per exercise)
    - **Weight toggle** (log progress: +/- 5 lbs increments)
        - Separate feature on same feedback page
        - Tracks personal records automatically
- All inputs flow back into the **internal scoring system**, influencing future workout generation.

## System Integrations

### Supabase Realtime

- Live updates between **mobile web app** and **TV app**.
- Any trainer edits (swap, reorder) propagate instantly.
- TV always reflects the **latest saved plan**.

### Twilio SMS

- Handles **session check-in** for trainers and clients.
- Distribution of workout preferences and feedback links

### Philips Hue

- TV app establishes a **direct LAN connection** to the Hue Bridge.
- Different light scenes triggered depending on workout phases (work, rest, transitions).

---