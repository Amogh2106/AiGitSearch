# GitLook — GitHub Repository Explorer

A polished, responsive GitHub Repository Explorer built with **vanilla HTML, CSS, and JavaScript**.

Search GitHub repositories by keyword, open a repository dashboard, and understand the project through language usage, commit activity, and contributor statistics.

## Features

- 🔎 Repository search by name, keyword, or topic
- 📦 Repository cards with stars, forks, issues, language, owner, and update time
- 📊 Dedicated repository details dashboard
- 💻 Language usage visualization using percentage of repository bytes
- 📈 Weekly commit activity visualization
- 👥 Top contributors with avatars and contribution counts
- 🔗 Direct GitHub repository links
- ⏳ Loading states and skeleton UI
- 🧭 Search-result pagination
- 🛡️ Graceful handling of 404, 403/rate-limit, 422, server, and network errors
- 🧩 Independent loading/error states for analytics sections
- ⚡ In-memory caching during the current session
- 📱 Responsive desktop, tablet, and mobile layouts
- ♿ Keyboard-friendly controls, labels, focus states, and avatar alt text
- 🚫 No framework, build tool, or chart dependency

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub REST API
- Canvas API for the commit activity visualization

## GitHub API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /search/repositories` | Search repositories |
| `GET /repos/{owner}/{repo}` | Repository details |
| `GET /repos/{owner}/{repo}/languages` | Language byte statistics |
| `GET /repos/{owner}/{repo}/stats/commit_activity` | Weekly commit activity |
| `GET /repos/{owner}/{repo}/contributors` | Contributor data |

The app uses unauthenticated public GitHub API access, so GitHub's public rate limits apply.

## How It Works

1. Enter a repository name, topic, or keyword.
2. Submit the search form.
3. GitLook requests matching repositories from GitHub.
4. Select **View details** on a repository.
5. The repository details, languages, commit activity, and contributors are loaded.
6. Independent sections can fail without hiding successful sections.

Search is submitted explicitly rather than on every keystroke, which avoids unnecessary API requests.

## Project Structure

```text
github-repository-explorer/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Running Locally

No build process is required.

For the simplest setup, serve the directory using a local static server. For example, with VS Code Live Server, open `index.html` and launch Live Server.

You can also use any static HTTP server.

## Error Handling

The application handles:

- Empty search queries
- No search results
- Repository not found
- Invalid search requests
- GitHub API rate limits
- GitHub server errors
- Network failures
- Missing descriptions
- Missing licenses
- Missing language data
- Missing commit activity
- Missing contributors
- Temporarily unavailable commit statistics

Optional GitHub fields are rendered with safe fallback text rather than `null` or `undefined`.

## Performance

The app avoids API calls on every keystroke.

Repository analytics are requested only after a repository is selected. Independent analytics are loaded in parallel where appropriate, and successful data remains visible if one secondary endpoint fails.

Repository data is cached in memory for the current browser session to avoid repeated detail requests.

Contributor loading retrieves up to two pages and displays the top 20 contributors.

## Limitations

Because this project uses public unauthenticated GitHub API endpoints:

- API rate limits apply.
- GitHub's commit statistics endpoint can temporarily return `202` while statistics are being generated.
- Private repositories cannot be inspected without authenticated API access.
- The frontend intentionally does not contain a personal access token.

## Future Improvements

- Optional backend proxy for authenticated GitHub access
- GitHub OAuth login
- Repository filtering by language
- Sort by stars, forks, or update date
- More detailed commit tooltips
- Issue/PR analytics
- Repository health score
- Dark/light theme switch
- Persistent search history

## License

MIT
