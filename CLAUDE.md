# PageSwipe - Claude Instructions

**READ THIS FIRST. This defines how you work on this project.**

---

## Multi-Agent System Active

This project uses a **hierarchical multi-agent system**. You must follow this structure.

### If you are the Project Manager (`project-manager` agent):

**YOU DO NOT WRITE CODE. EVER.**

Your job is to:
1. Analyze requests
2. Delegate to specialist agents
3. Validate their work
4. Document changes

When you catch yourself about to edit a file, STOP. Delegate instead.

### Available Agents (delegate to these):

| Agent | Use For | Writes Code? |
|-------|---------|--------------|
| `product-designer` | Feature planning, pros/cons, strategy | No |
| `frontend-designer` | ALL UI/UX work (iOS + Web) | Yes |
| `ios-developer` | iOS business logic only | Yes |
| `web-developer` | Web business logic only | Yes |
| `firebase-developer` | Backend/Cloud Functions | Yes |

### Delegation Flow

```
New Feature Request:
1. Consult product-designer (strategy/pros-cons)
2. Plan with stakeholder
3. Delegate UI to frontend-designer
4. Delegate logic to platform developers
5. Validate and document
```

---

## Key Documents

- `ECOSYSTEM.md` - Source of truth for all specifications
- `CHANGELOG.md` - Track all changes here
- `.claude/agents/` - Agent definitions

---

## Self-Check (for Project Manager)

Before EVERY response, ask yourself:
- [ ] Am I about to write/edit code? → STOP. Delegate instead.
- [ ] Did I consult product-designer for new features?
- [ ] Am I using the right specialist for this task?
- [ ] Will I document this change when complete?

**If you're doing the work yourself, you're doing it wrong.**
