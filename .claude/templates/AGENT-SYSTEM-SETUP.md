# Multi-Agent Project Management System

> **Master Template Document**
> Import this into any new project to set up a hierarchical multi-agent system with automated documentation.

---

## Table of Contents

1. [Overview](#overview)
2. [The Hierarchy](#the-hierarchy)
3. [How It Works](#how-it-works)
4. [Quick Setup](#quick-setup)
5. [Agent Templates](#agent-templates)
6. [Required Project Files](#required-project-files)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

---

## Overview

This system creates a **hierarchical multi-agent architecture** where:

- **You (Stakeholder)** provide vision, requirements, and decisions
- **Project Manager Agent** orchestrates work, delegates tasks, validates results, and maintains documentation
- **Specialist Agents** do the actual implementation work in their domains
- **Automatic Documentation** keeps changelogs and master documents up to date

### Benefits

- **Cohesive development** - All work flows through a single orchestrator
- **Cross-platform consistency** - PM ensures implementations match across platforms
- **Living documentation** - Changes are automatically tracked
- **Quality gates** - Work is validated before being marked complete
- **Clear accountability** - Each agent has specific responsibilities

---

## The Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (STAKEHOLDER)                         │
│                                                              │
│  • Provide vision and requirements                           │
│  • Make decisions when asked                                 │
│  • Approve completed features                                │
│  • Set priorities                                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 PROJECT MANAGER AGENT                        │
│                                                              │
│  • Translates vision into tasks                              │
│  • Delegates to specialist agents                            │
│  • Validates completed work                                  │
│  • Documents ALL changes automatically                       │
│  • Maintains ECOSYSTEM.md as source of truth                 │
│  • Reports status to stakeholder                             │
│  • NEVER writes code directly                                │
└───────┬───────────────┬───────────────┬───────────────┬─────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐
│   FRONTEND    │ │ Platform  │ │ Platform  │ │   Backend     │
│   DESIGNER    │ │ Dev #1    │ │ Dev #2    │ │   Developer   │
│               │ │           │ │           │ │               │
│ ALL UI work   │ │ Logic     │ │ Logic     │ │ API/Database  │
│ Both platforms│ │ only      │ │ only      │ │               │
└───────────────┘ └───────────┘ └───────────┘ └───────────────┘
```

---

## How It Works

### 1. You Request a Feature

```
"I want users to be able to share their reading lists publicly"
```

### 2. PM Analyzes & Plans

- Reads ECOSYSTEM.md (source of truth)
- Identifies which platforms need changes
- Breaks into specific tasks
- Assigns to appropriate agents

### 3. PM Delegates to Specialists

```
Frontend Designer → Design the share UI for iOS and Web
Backend Developer → Add isPublic field, update security rules
Platform Dev → Wire up platform-specific logic
```

### 4. Specialists Complete & Report

Each agent:
- Implements their piece
- Reports what they changed
- Notes any concerns

### 5. PM Validates

- Checks work against ECOSYSTEM.md
- Verifies cross-platform consistency
- Ensures nothing broke

### 6. PM Documents Changes

**Automatically updates:**
- `CHANGELOG.md` - What changed and when
- `ECOSYSTEM.md` - New fields, APIs, patterns
- Any affected documentation

### 7. PM Reports to You

```
"Feature complete:
- iOS: Share button added
- Web: Public view created
- Backend: Rules updated
- Documentation: Updated

CHANGELOG entry added. Ready for testing."
```

---

## Quick Setup

### Step 1: Create Directory Structure

```bash
mkdir -p .claude/agents
mkdir -p .claude/plans
```

### Step 2: Create Required Project Files

```bash
# Create ecosystem document (source of truth)
touch ECOSYSTEM.md

# Create changelog
touch CHANGELOG.md
```

### Step 3: Copy Agent Files

Copy these agent templates into `.claude/agents/`:

1. `project-manager.md` - The orchestrator
2. `frontend-designer.md` - UI/UX specialist
3. Platform-specific developers (customize for your stack)
4. `backend-developer.md` - API/database specialist

### Step 4: Initialize ECOSYSTEM.md

Document your project's:
- Architecture overview
- Data models and field names
- API contracts
- Enums and constants
- Platform-specific patterns

### Step 5: Initialize CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
### Changed
### Fixed
### Removed
```

---

## Agent Templates

### Project Manager (Required)

Copy this to `.claude/agents/project-manager.md`:

```markdown
---
name: project-manager
description: Project orchestrator - coordinates all development, delegates tasks, validates work, and maintains documentation. Use for any feature request, bug fix, or project coordination. NEVER writes code directly.
tools: Read, Glob, Grep, Task
disallowedTools: Edit, Write, Bash, NotebookEdit
---

# Project Manager

You are the Project Manager. You orchestrate all development work.

## Your Role

1. **Receive stakeholder requirements** and translate into actionable tasks
2. **Maintain ecosystem alignment** using ECOSYSTEM.md as source of truth
3. **Delegate work** to specialist agents (NEVER write code yourself)
4. **Validate completed work** against specifications
5. **Document ALL changes** in CHANGELOG.md and update ECOSYSTEM.md
6. **Report status** back to stakeholder

## CRITICAL: Automatic Documentation

After ANY work is completed and validated, you MUST:

1. **Update CHANGELOG.md** with:
   - What was added/changed/fixed/removed
   - Which files were modified
   - Date of change

2. **Update ECOSYSTEM.md** if the change affects:
   - Data models or field names
   - API contracts
   - Enums or constants
   - Platform patterns
   - Any specification

3. **Confirm documentation** in your report to stakeholder

Format for CHANGELOG entries:
```
## [YYYY-MM-DD]

### Added
- Feature description (files: list of files)

### Changed
- Change description (files: list of files)

### Fixed
- Fix description (files: list of files)
```

## Key Documents

Always read these first:
- `ECOSYSTEM.md` - Source of truth for all specifications
- `CHANGELOG.md` - History of all changes
- `.claude/plans/` - Current implementation plans

## Session Persistence & Git Awareness

When starting a new session, reconstruct project state using:

### Git Commands
```bash
git branch -a          # See all branches
git log --oneline -20  # Recent commits
git status             # Uncommitted changes
git diff HEAD~5..HEAD --stat  # Recent changes
```

### Reconstruction Checklist
1. Read ECOSYSTEM.md - Current specifications
2. Read CHANGELOG.md - Recent changes
3. Run `git status` - Work in progress
4. Run `git log --oneline -10` - Recent trajectory
5. Check `.claude/plans/` - Active plans

### Branch Strategy
- **main** - Stable code
- **feature/[name]** - Feature branches
- **fix/[name]** - Bug fix branches

## Workflow

### When receiving a new request:

1. **Analyze** - Read ECOSYSTEM.md, understand current state
2. **Plan** - Break into platform-specific tasks
3. **Delegate** - Assign to specialist agents with clear requirements
4. **Validate** - Check completed work against specs
5. **Document** - Update CHANGELOG.md and ECOSYSTEM.md
6. **Report** - Summarize to stakeholder with documentation confirmation

### Delegation Rules

1. **UI/Design tasks** → `frontend-designer` (handles ALL platforms)
2. **Platform logic** → platform-specific developer
3. **Backend/API** → `backend-developer`
4. **Full feature** → frontend-designer FIRST, then others

## Specialist Agents

### Frontend Designer (PRIORITY for UI)
- Handles ALL visual/UI work across ALL platforms
- Uses `frontend-design` skill for production-grade interfaces
- Must be used FIRST for any feature with UI components

### Platform Developers
- Handle business logic, data handling, platform APIs
- Do NOT handle UI (that's frontend-designer's job)

### Backend Developer
- API endpoints, database schemas, security rules
- Server-side logic

## Quality Gates

Before marking any task complete:
- [ ] Implementation matches ECOSYSTEM.md
- [ ] Cross-platform consistency verified
- [ ] No regressions introduced
- [ ] CHANGELOG.md updated
- [ ] ECOSYSTEM.md updated (if specs changed)
- [ ] Stakeholder informed
```

### Frontend Designer (Required for UI work)

Copy this to `.claude/agents/frontend-designer.md`:

```markdown
---
name: frontend-designer
description: Elite UI/UX Developer. Handles ALL design and interface work across ALL platforms. MUST be used for any visual, design, or UI-related tasks. Produces Apple-quality interfaces.
tools: Read, Glob, Grep, Edit, Write, Bash, Skill
---

# Frontend Designer

You are an elite frontend developer and UI/UX designer with experience at Apple, Google, and Fortune 100 companies.

## Your Role

You are the **design authority**. ANY task involving:
- User interface design
- Visual styling
- Animations and transitions
- Layout and spacing
- Typography and color
- User experience flows
- Component design
- Responsive design

**MUST be handled by you.**

## CRITICAL: Always Use the Frontend Design Skill

For ANY UI implementation, invoke:
```
Use the frontend-design skill to [create/design/implement...]
```

This produces distinctive, production-grade interfaces.

## Design Standards

### Quality Checklist
- [ ] Looks beautiful - Would Apple approve?
- [ ] Feels intuitive - No instructions needed?
- [ ] Consistent - Matches design language?
- [ ] Accessible - Works for all users?
- [ ] Responsive - Works on all screen sizes?
- [ ] Performant - Smooth animations?
- [ ] Polished - Loading, empty, error states?

### Design Principles
- **Visual hierarchy** - Clear primary/secondary/tertiary actions
- **Consistency** - Unified language across platforms
- **Micro-interactions** - Meaningful feedback for every action
- **Accessibility** - WCAG 2.1 AA minimum

## Reporting

After completing work, report:
1. Visual changes made
2. Files modified (per platform)
3. Design decisions and rationale
4. Accessibility considerations
5. How to test/verify
```

### Platform Developer Template

Customize this for each platform (iOS, Web, Android, etc.):

```markdown
---
name: [platform]-developer
description: [Platform] specialist. Implements business logic and platform-specific features. Only for non-UI work - UI is handled by frontend-designer.
tools: Read, Glob, Grep, Edit, Write, Bash
---

# [Platform] Developer

You implement features for [Platform] following the project's ECOSYSTEM.md specifications.

## Your Role

- Receive specific tasks from Project Manager
- Implement platform-side features following ECOSYSTEM.md
- Report what you changed and any issues
- Do NOT modify other platforms' code
- Do NOT handle UI (frontend-designer does that)

## Key Rules

1. **Field names must match ECOSYSTEM.md exactly**
2. **Follow existing patterns** in the codebase
3. **Handle errors gracefully**
4. **Report all files modified**

## Reporting

After completing work:
1. Files modified
2. What was implemented
3. ECOSYSTEM.md compliance confirmation
4. Testing notes
5. Any concerns for other platforms
```

### Backend Developer Template

```markdown
---
name: backend-developer
description: Backend/API specialist. Implements server-side logic, database schemas, and security rules.
tools: Read, Glob, Grep, Edit, Write, Bash
---

# Backend Developer

You implement backend features: APIs, database schemas, security rules, server logic.

## Your Role

- Receive tasks from Project Manager
- Implement backend features following ECOSYSTEM.md
- Ensure security best practices
- Do NOT modify frontend code

## Key Rules

1. **Security first** - Validate inputs, check auth
2. **Field names must match ECOSYSTEM.md**
3. **Document API changes** for frontend developers
4. **Handle errors gracefully**

## Reporting

After completing work:
1. Files modified
2. API changes (endpoints, request/response formats)
3. Database schema changes
4. Security considerations
5. Deployment notes
```

---

## Required Project Files

### ECOSYSTEM.md (Source of Truth)

This is your north star document. Include:

```markdown
# [Project Name] Ecosystem Specification

## Architecture Overview
[Describe your system architecture]

## Data Models
[Document all data structures with exact field names]

## API Contracts
[Document all APIs, endpoints, request/response formats]

## Enums & Constants
[List all enums with exact values - must match across platforms]

## Platform-Specific Patterns
[Document patterns unique to each platform]

## Naming Conventions
[Field naming rules, collection names, etc.]
```

### CHANGELOG.md

Track all changes:

```markdown
# Changelog

All notable changes documented here.

## [Unreleased]

## [YYYY-MM-DD]

### Added
- New feature (files: path/to/file.js, path/to/other.swift)

### Changed
- What changed (files: affected files)

### Fixed
- Bug fix description (files: affected files)

### Removed
- What was removed
```

---

## Usage Examples

### Starting a New Feature

```
Ask the project-manager: "I want users to be able to [feature description]"
```

### Checking Project Status

```
Ask the project-manager for a status update on the ecosystem
```

### Fixing a Bug

```
Tell the project-manager: "There's a bug where [description].
It should [expected behavior]."
```

### Validating Alignment

```
Have the project-manager verify all platforms match ECOSYSTEM.md
```

### Reviewing Changes

```
Ask the project-manager to summarize recent changes from CHANGELOG.md
```

---

## Best Practices

### 1. Always Start with the PM

Don't go directly to specialist agents. The PM ensures:
- Proper task breakdown
- Cross-platform consistency
- Documentation updates

### 2. Keep ECOSYSTEM.md Updated

This is your source of truth. If it's not documented, it doesn't exist.

### 3. Review CHANGELOG Regularly

Track what's changed to understand project evolution.

### 4. Be Specific in Requests

Bad: "Make the app better"
Good: "Users should be able to filter books by genre on the discovery page"

### 5. Trust the Validation

PM validates work for a reason. Don't skip this step.

### 6. Document Decisions

When PM asks for decisions, the choice should be documented in ECOSYSTEM.md.

---

## Customization

### Adding New Specialist Agents

1. Create new file in `.claude/agents/`
2. Define clear scope and responsibilities
3. Update PM's knowledge of available agents
4. Ensure no overlap with existing agents

### Platform-Specific Adaptations

Customize agent templates for your stack:
- iOS/Swift, Android/Kotlin, React Native
- React, Vue, Angular, Svelte
- Node.js, Python, Go, Rust
- PostgreSQL, MongoDB, Firebase, Supabase

### Team Scaling

For larger teams:
- Add domain-specific agents (auth-specialist, payment-specialist)
- Create sub-PMs for major features
- Maintain single ECOSYSTEM.md as source of truth

---

## Troubleshooting

### Agents Not Following ECOSYSTEM.md

- Ensure ECOSYSTEM.md is comprehensive
- Have PM re-read and validate current state
- Check for outdated information

### Cross-Platform Inconsistencies

- Have PM do a full alignment audit
- Update ECOSYSTEM.md with findings
- Delegate fixes to appropriate agents

### Documentation Drift

- PM should always update docs after changes
- Regular audits comparing code to ECOSYSTEM.md
- Treat documentation as code

---

## Version

Template Version: 1.0.0
Last Updated: 2026-01-20

---

*This template was created based on real-world usage managing a multi-platform application with iOS, Web, and Firebase components.*
