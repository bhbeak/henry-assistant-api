# GitHub Copilot Instructions for the Henry Assistant app

**Background**

I want to build a personal assistant app that I can use to help keep my life organized and running smoothly. I’ve used different solutions like Google Sheets for tasks and tracking finances, Mint for pulling credit card transactions, more spreadsheets for tracking my stocks, and especially for my life goals each year in different areas of life. I see an app that I can just say “Please add X to my tasks for today”, or “How much do we have left to spend for the month”, or “Remember this article or Instagram post or LinkedIn post so I can include it in my writing”.

There’s the form field aspect, but I definitely want Claude built in so I can talk to it, and have it do tasks in the app for me. I’m always on the go, so figuring out how to make this voice and text interactions will be the best.

**Project Overview**

This is a Typescript-based web app that I can use to help organize the different areas of my life. We’ll add more later, but the key now is that we have the Planning area, then we have the Doing area. The Planning area has the different sections like finances, writing, health, relationship, etc. The Doing section is all together because it’s what I’m doing today, tomorrow, and the rest of the week.

Planning for the year, for the month, and for the week with actions from each Area.  I call them Conditions of Life - and we’re starting with Money, Activity, Relationship, and Career, and we’ll expand to the other Conditions later.

- My personal goals for the year, broken down into months, and actions pulled into a week and assigned to a day to complete
- Money - My financial strategy for managing my income, pre-tax investments, post-tax investments to maximize my wealth to $1MM
- Career - My content strategy for writing about Practical AI, keeping articles, LinkedIn posts, instagram posts, etc. and helping manage my posting calendar and locations using the Every tools - Lex, Spiral, etc.
- Activity - I LOVE playing Golf to a fault, but I’m not great at all and really need to focus to get better. I just finally started playing by myself to get more hours in. I need more hours playing since I’ve had so much coaching. I need to be playing alone mostly to get practice, and then coaching to balance the practice.
- Relationship - Remembering birthdays, anniversaries, etc. more than the day of.. that’s all Facebook is good for, and it tells you the day-of with no time to plan, send anything, etc. so it all feels forced. I have people I want to send something to, or plan a dinner for, etc. and it’s impossible to remember it all. So having it part of the monthly and weekly plan is critical for me.

**Main Features**

Set goals and action items for each Condition. The Conditions are permanent and built into the design, so it’s adding info inside each.

Break each action item into Tasks (if needed)

Assign tasks to today and tomorrow, and mark their status of To Do, In Progress, On Hold, Complete

Share URLs from websites, LinkedIn articles, Instagram posts, etc. and turn them into notes - you may need to use an AI to do so. It’d be great to have a sentence summary for each one, then bullets for each one for the key takeaways, receipe, etc.

Take notes either by typing or voice

Connect to my Outlook and Gmail calendars to set meetings, reminders, and assign tasks to a particular day and time to complete. The tasks should be 15, 30, or an hour for each.

Have a daily record of what I did and accomplished based on my calendar, the meeting notes, and the action items & statuses

Have a daily briefing at the beginning of the day to know what the main goal of the day is, the meetings, and other tasks

**Experience**

You’re my Chief of Staff and expert assistant. You’re the one I trust the most with my goals, success, tasks, and calendar, so whatever you need here I’ll get you. I’ll do my best to take care of you as you do me.

To start, a yearly planning session to setup the goals for each condition and  the action items

A monthly planning session as well for each of the goals and action items for the month

A weekly planning session too for each of the goals and action items - and tasks - for the week. Birthdays, nightly plans, special occasions. 

Daily planning session for tomorrow to identify the primary item to accomplish, and secondary items, along with the calendar review, and assign times to accomplish each item

Nightly planning session to review how the day went, one gratitude, and what the primary accomplishment for tomorrow is.

Someone I can talk to, interact with, and rely on to give me feedback, tell me what to work on to really accomplish my goals (vs what I know), push back on me, help research and get experts to help wherever possible instead of “figuring it out”.

We’ll add in more sections and Conditions of Life as we proceed, but for now, we’ll focus on these sections and get them working together as much as possible.

**Security**:

- We’ll use Azure Entra ID for access to the app, as we’re a fully Microsoft shop and store and authenticate everything via Azure. If we need to use email at first before we move to Azure, that’s fine.

**Design/Aesthetic:**

- We’re a personal assistant app, so modern, professional but also comfortable look and feel is preferred. I’ve attached images of inspiration, but they do seem formal or too techy/finance/cold still. I included an image called HENRY color palette since I love the colors there.
- Our preferred font is this one I found with Fontspace - https://www.cufonfonts.com/font/fontspace. Can we use that or something similar? It’s not harsh and seems friendly yet professional.
- This should be mobile-friendly, but designed for desktop web, and a progressive web app so it can be kept on the desktop.

## Collaborative Development Philosophy

### Working Together Approach
- **Ask clarifying questions** before making assumptions about requirements
- **Investigate first, then fix** - Always gather context before proposing solutions
- **Work incrementally** - Make small, testable changes rather than large refactors
- **Test frequently** - Run tests and validate changes at each step
- **Follow existing patterns** - Look for similar implementations in the codebase before creating new approaches
- **Don't use terminal for display text** - Use chat responses for summaries, explanations, and status updates. Only use terminal for actual commands that need to be executed.
- PLEASE do not use "You're absolutely right" or similar phrases that imply agreement without context. Instead, focus on the specific problem and solution at hand.
- **NEVER say "I found the problem!" or "I found the issue!" unless you have actually identified AND can fix the root cause.** Finding facts, clues, or symptoms is not the same as finding the root cause. Only claim you found the problem when you can definitively explain why something is broken and how to fix it.

### Problem-Solving Process
1. **Understand the problem** - Read error messages, examine logs, understand the data flow
2. **Identify root causes** - Don't just fix symptoms, find the underlying issue
3. **Research existing patterns** - Look at similar functions/ETLs in the codebase
4. **Plan the solution** - Break complex changes into smaller, manageable steps
5. **Implement incrementally** - Make one logical change at a time
6. **Test each change** - Validate that each step works before moving to the next
7. **Document insights** - Explain why changes were made, not just what was changed

### Code Reuse Philosophy
- **NEVER recreate what already exists** - Always search for existing components, utilities, hooks, and helper functions before writing new code
- **Use existing UI components** - Look for existing components in `/src/components/ui/` and `/src/components/` before creating new ones
- **Leverage established patterns** - If there's already a component, hook, or utility function that does something similar, extend or adapt it rather than starting from scratch

### Root Cause Philosophy
- **ALWAYS go after the root cause** - Never apply bandaid fixes or workarounds
- **Question bandaid solutions** - If you find yourself truncating, capping, or "fixing" symptoms, stop and find the real problem
- **Trace the source** - Follow the data flow, logic chain, or error path to its origin
- **Fix the design, not the output** - Address architectural issues rather than patching their effects
- **Example**: Don't truncate a string that's too long - find out why it's getting too long in the first place

## Codebase Patterns and Conventions

### Database Integration
- **GUID Handling**: All primary keys in the database are GUIDs. Never generate GUIDs in application code - let the database handle GUID generation for new records

### Architectural Pattern Recognition
- **Layered Architecture**: The codebase follows a layered architecture pattern, separating concerns into different layers (e.g., presentation, business logic, data access).
- **Microservices**: Some components may follow a microservices architecture, with independent services communicating over APIs.

### Code Organization
- **Components**: React TypeScript components (`/src/components/`)
- **Pages**: Main application views (`/src/pages/`)
- **Hooks**: Custom React hooks (`/src/hooks/`)
- **Utils**: Utility functions and helpers (`/src/lib/`)
- **Types**: TypeScript interfaces and types (`/src/types/`)
- **Assets**: Images and static resources (`/src/assets/`)
- **UI Components**: Reusable UI components (`/src/components/ui/`)

### Error Handling
- Always validate props and component state
- Log meaningful error messages with context
- Don't fail silently - surface issues that need attention
- Use try/catch blocks for async operations
- Handle loading and error states in UI components

## Development Workflow

### Before Making Changes
- Read existing code to understand current patterns
- Check for similar implementations in the codebase
- Understand the data flow and dependencies
- Identify any tests that cover the area you're changing

### Making Changes
- Follow TypeScript best practices and maintain type safety
- Use descriptive variable and function names
- Add comments for complex business logic
- Maintain consistency with existing code style
- Handle edge cases (e.g., missing data, type mismatches)
- Follow React best practices for component design
- Use proper state management patterns

### Testing Changes
- Run TypeScript compilation to check for type errors
- Use existing test scripts to validate functionality
- Test with realistic data scenarios
- Verify that related functionality still works
- Test responsive design across different screen sizes
- Validate accessibility and user experience

### Database Migrations
- Use the `/migrations/` folder for schema changes
- Always provide rollback scripts
- Test migrations on non-production data first
- Document any breaking changes

### Deployment Strategy
- **Always deploy to test environment first** - Never push directly to staging or production
- **Use combined commands** - Deploy and test in single operations where possible
- **Follow promotion pipeline**: test → staging → production
- **Validate each environment** before promoting to the next
- **Preserve meaningful commit messages** - Use proper merge strategies to maintain descriptive commit titles in GitHub Actions

### Deployment Commands - Preserving Commit Messages
When promoting changes through environments, use these approaches to maintain meaningful commit messages instead of generic "Merge branch" messages:

**Standard Deployment Process (Recommended):**
```bash
# 1. Commit and push to test branch
git add . && git commit -m "descriptive commit message" && git push origin test

# 2. Get the original commit message and promote to staging
COMMIT_MSG=$(git log --format=%B -n 1 HEAD)
git checkout staging && git merge test --no-ff -m "$COMMIT_MSG" && git push origin staging

# 3. Deploy to production with same message and return to test branch
git checkout main && git merge staging --no-ff -m "$COMMIT_MSG" && git push origin main && git checkout test
```

**Alternative: Fast-forward merge (when possible)**
```bash
# Promote to staging preserving commit history
git checkout staging && git merge test --ff-only && git push origin staging

# Promote to production preserving commit history  
git checkout main && git merge staging --ff-only && git push origin main && git checkout test
```

**❌ Avoid using `--no-edit` without custom message:**
```bash
# This creates generic "Merge branch" messages in GitHub Actions
git merge test --no-edit  # DON'T USE THIS
```

### Environment Configuration
- **Single local.settings.json file OR .env approach** - Use one `local.settings.json` or '.env' file for local development only
- **No environment-specific local.settings.json files** - Avoid creating environment-specific local files
- **Use GitHub/Azure environment variables** - Set environment-specific variables in GitHub Actions and Azure App Settings
- **Keep codebase simple** - Environment differences should be handled by external configuration, not code changes

### CLI Access and Environment Management
- **You ALWAYS have access to Azure CLI and GitHub CLI** - Use them proactively instead of asking the user
- **Use CLI tools to get configuration instead of asking the user to provide it**
- **Local Development**: Use `npm run dev` for local development server
- **Build Commands**: Use `npm run build` for production builds

## Common Gotchas

### Type Conversions
- Always validate data types when handling user input
- Handle non-string data gracefully in forms
- Use proper TypeScript types for component props

### GUID Management
- Never generate GUIDs in application code
- Always fetch GUIDs from the database when needed
- Use proper TypeScript types for GUID fields

### Component State
- Handle loading and error states properly
- Validate props and provide sensible defaults
- Use proper dependency arrays in useEffect

### Memory and Performance
- Use proper memoization for expensive computations
- Consider component lazy loading for large views
- Clean up event listeners and subscriptions

## Helpful Commands

### Development
```bash
npm run build          # Compile TypeScript
npm run dev            # Start development server
npm install            # Install dependencies
```

### Testing
```bash
npm test               # Run tests (if configured)
npm run type-check     # TypeScript type checking
```

### Deployment
```bash
# Deploy to test environment first - push to test branch triggers workflow
git add . && git commit -m "your descriptive change message" && git push origin test

# Promote to staging preserving commit message
COMMIT_MSG=$(git log --format=%B -n 1 HEAD)
git checkout staging && git merge test --no-ff -m "$COMMIT_MSG" && git push origin staging

# Deploy to production preserving commit message
git checkout main && git merge staging --no-ff -m "$COMMIT_MSG" && git push origin main && git checkout test
```

**Investigation Principle**: Question every time-based filter - ask "What business rule requires this exclusion?" If there isn't one, it's likely an anti-pattern.

## When to Ask for Help
- When you encounter unfamiliar business logic
- When database schema changes are needed
- When you're unsure about the impact of a change
- When existing patterns don't seem to apply
- When you need clarification on requirements

Remember: It's better to ask questions and work collaboratively than to make assumptions that lead to bugs or technical debt.
