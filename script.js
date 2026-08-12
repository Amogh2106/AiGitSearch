const API_BASE = "https://api.github.com";
const state = {
    query: "",
    page: 1,
    perPage: 10,
    totalCount: 0,
    currentRepo: null,
    cache: new Map(),
    controllers: new Set()
};

const $ = (selector) => document.querySelector(selector);

const elements = {
    form: $("#search-form"),
    input: $("#search-input"),
    searchBtn: $("#search-btn"),
    searchBtnText: $("#search-btn-text"),
    searchSpinner: $("#search-spinner"),
    apiStatus: $("#api-status"),
    apiStatusText: $("#api-status-text"),
    searchView: $("#search-view"),
    resultsView: $("#results-view"),
    repositoryView: $("#repository-view"),
    homeMessage: $("#home-message"),
    resultsTitle: $("#results-title"),
    resultCount: $("#result-count"),
    resultsLoading: $("#results-loading"),
    resultsError: $("#results-error"),
    resultsEmpty: $("#results-empty"),
    resultsGrid: $("#results-grid"),
    pagination: $("#pagination"),
    prevPage: $("#prev-page"),
    nextPage: $("#next-page"),
    pageLabel: $("#page-label"),
    backBtn: $("#back-btn"),
    detailsLoading: $("#details-loading"),
    detailsError: $("#details-error"),
    repositoryContent: $("#repository-content"),
    detailAvatar: $("#detail-avatar"),
    detailOwner: $("#detail-owner"),
    detailName: $("#detail-name"),
    detailTitle: $("#detail-title"),
    detailDescription: $("#detail-description"),
    topicList: $("#topic-list"),
    githubLink: $("#github-link"),
    detailStars: $("#detail-stars"),
    detailForks: $("#detail-forks"),
    detailIssues: $("#detail-issues"),
    detailLanguage: $("#detail-language"),
    detailLicense: $("#detail-license"),
    detailCreated: $("#detail-created"),
    detailUpdated: $("#detail-updated"),
    detailUrl: $("#detail-url"),
    languagesLoading: $("#languages-loading"),
    languagesError: $("#languages-error"),
    languagesEmpty: $("#languages-empty"),
    languageBars: $("#language-bars"),
    activityLoading: $("#activity-loading"),
    activityError: $("#activity-error"),
    activityEmpty: $("#activity-empty"),
    activityChartWrap: $("#activity-chart-wrap"),
    activityChart: $("#activity-chart"),
    contributorsLoading: $("#contributors-loading"),
    contributorsError: $("#contributors-error"),
    contributorsEmpty: $("#contributors-empty"),
    contributorsGrid: $("#contributors-grid"),
    contributorCount: $("#contributor-count"),
    toast: $("#toast")
};

document.addEventListener("DOMContentLoaded", () => {
    elements.form.addEventListener("submit", handleSearch);
    elements.prevPage.addEventListener("click", () => changePage(state.page - 1));
    elements.nextPage.addEventListener("click", () => changePage(state.page + 1));
    elements.backBtn.addEventListener("click", showResults);
    $("#brand-link").addEventListener("click", (event) => {
        event.preventDefault();
        showSearch();
    });

    document.querySelectorAll(".text-example").forEach((button) => {
        button.addEventListener("click", () => {
            elements.input.value = button.dataset.query;
            elements.form.requestSubmit();
        });
    });

    window.addEventListener("resize", debounce(() => {
        if (state.currentRepo?.activity) drawActivityChart(state.currentRepo.activity);
    }, 150));
});

async function handleSearch(event) {
    event.preventDefault();

    const query = elements.input.value.trim();
    if (!query) {
        showToast("Enter a repository name or keyword first.");
        elements.input.focus();
        return;
    }

    state.query = query;
    state.page = 1;
    await searchRepositories(query, 1);
}

async function searchRepositories(query, page = 1) {
    showResults();
    setSearchLoading(true);
    clearResultsState();

    try {
        const data = await apiFetch(
            `/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${state.perPage}&sort=best-match`,
            { signal: createController() }
        );

        if (!data || !Array.isArray(data.items)) {
            throw new Error("GitHub returned an unexpected search response.");
        }

        state.totalCount = Number(data.total_count) || 0;
        state.page = page;

        elements.resultsTitle.textContent = `Results for "${query}"`;
        elements.resultCount.textContent = `${formatNumber(state.totalCount)} repositories`;

        if (data.items.length === 0) {
            elements.resultsEmpty.classList.remove("hidden");
            elements.pagination.classList.add("hidden");
            return;
        }

        renderRepositories(data.items);
        updatePagination();
    } catch (error) {
        if (error.name !== "AbortError") {
            elements.resultsError.textContent = friendlyError(error);
            elements.resultsError.classList.remove("hidden");
        }
    } finally {
        setSearchLoading(false);
    }
}

function renderRepositories(repositories) {
    elements.resultsGrid.innerHTML = repositories.map((repo) => {
        const description = repo.description || "No description provided.";
        const language = repo.language || "Unknown";
        return `
            <article class="repo-card">
                <div class="repo-top">
                    <img class="owner-avatar"
                         src="${escapeAttr(repo.owner?.avatar_url || fallbackAvatar(repo.owner?.login))}"
                         alt="${escapeAttr(repo.owner?.login || "Repository owner")} avatar"
                         loading="lazy">
                    <div style="min-width:0">
                        <h3 class="repo-title" title="${escapeAttr(repo.full_name)}">${escapeHTML(repo.name)}</h3>
                        <p class="repo-owner">${escapeHTML(repo.owner?.login || "Unknown owner")}</p>
                    </div>
                </div>

                <p class="repo-description">${escapeHTML(description)}</p>

                <div class="repo-meta">
                    <span class="meta-item"><span class="language-dot"></span>${escapeHTML(language)}</span>
                    <span class="meta-item">★ ${formatNumber(repo.stargazers_count)}</span>
                    <span class="meta-item">⑂ ${formatNumber(repo.forks_count)}</span>
                    <span class="meta-item">◌ ${formatNumber(repo.open_issues_count)}</span>
                </div>

                <div class="repo-bottom">
                    <span class="updated">Updated ${formatRelativeDate(repo.updated_at)}</span>
                    <button class="details-btn" type="button"
                        data-owner="${escapeAttr(repo.owner?.login || "")}"
                        data-repo="${escapeAttr(repo.name)}">
                        View details →
                    </button>
                </div>
            </article>
        `;
    }).join("");

    elements.resultsGrid.querySelectorAll(".details-btn").forEach((button) => {
        button.addEventListener("click", () => {
            openRepository(button.dataset.owner, button.dataset.repo);
        });
    });
}

async function openRepository(owner, repo) {
    showRepositoryView();
    state.currentRepo = { owner, repo };
    resetDetailSections();
    elements.detailsLoading.classList.remove("hidden");
    elements.detailsError.classList.add("hidden");
    elements.repositoryContent.classList.add("hidden");

    const cacheKey = `${owner}/${repo}`;
    const cached = state.cache.get(cacheKey);

    if (cached?.details) {
        renderRepository(cached.details);
        elements.detailsLoading.classList.add("hidden");
        elements.repositoryContent.classList.remove("hidden");
        loadRepositoryAnalytics(owner, repo, cached);
        return;
    }

    try {
        const details = await apiFetch(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            { signal: createController() }
        );

        state.cache.set(cacheKey, { details });
        renderRepository(details);

        elements.detailsLoading.classList.add("hidden");
        elements.repositoryContent.classList.remove("hidden");

        loadRepositoryAnalytics(owner, repo, state.cache.get(cacheKey));
    } catch (error) {
        elements.detailsLoading.classList.add("hidden");
        elements.detailsError.textContent = friendlyError(error);
        elements.detailsError.classList.remove("hidden");
    }
}

function renderRepository(repo) {
    elements.detailAvatar.src = repo.owner?.avatar_url || fallbackAvatar(repo.owner?.login);
    elements.detailAvatar.alt = `${repo.owner?.login || "Repository owner"} avatar`;
    elements.detailOwner.textContent = repo.owner?.login || "Unknown owner";
    elements.detailName.textContent = repo.name || "";
    elements.detailTitle.textContent = repo.name || "Repository";
    elements.detailDescription.textContent = repo.description || "No description provided for this repository.";

    elements.topicList.innerHTML = Array.isArray(repo.topics)
        ? repo.topics.slice(0, 8).map((topic) => `<span class="topic">${escapeHTML(topic)}</span>`).join("")
        : "";

    elements.githubLink.href = repo.html_url || "#";
    elements.detailUrl.href = repo.html_url || "#";
    elements.detailStars.textContent = formatNumber(repo.stargazers_count);
    elements.detailForks.textContent = formatNumber(repo.forks_count);
    elements.detailIssues.textContent = formatNumber(repo.open_issues_count);
    elements.detailLanguage.textContent = repo.language || "Not specified";
    elements.detailLicense.textContent = repo.license?.spdx_id || repo.license?.name || "No license specified";
    elements.detailCreated.textContent = formatDate(repo.created_at);
    elements.detailUpdated.textContent = formatDate(repo.updated_at);
}

async function loadRepositoryAnalytics(owner, repo, cache) {
    const tasks = [
        loadLanguages(owner, repo, cache),
        loadActivity(owner, repo, cache),
        loadContributors(owner, repo, cache)
    ];
    await Promise.allSettled(tasks);
}

async function loadLanguages(owner, repo, cache) {
    setSectionLoading(elements.languagesLoading, elements.languagesError, elements.languagesEmpty, elements.languageBars);

    if (cache.languages) {
        renderLanguages(cache.languages);
        return;
    }

    try {
        const data = await apiFetch(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
            { signal: createController() }
        );

        const languages = data && typeof data === "object" ? data : {};
        cache.languages = languages;

        if (Object.keys(languages).length === 0) {
            elements.languagesLoading.classList.add("hidden");
            elements.languagesEmpty.classList.remove("hidden");
            return;
        }

        renderLanguages(languages);
    } catch (error) {
        showSectionError(elements.languagesLoading, elements.languagesError, friendlyError(error));
    }
}

function renderLanguages(languages) {
    elements.languagesLoading.classList.add("hidden");
    elements.languagesError.classList.add("hidden");
    elements.languagesEmpty.classList.add("hidden");

    const entries = Object.entries(languages)
        .filter(([, bytes]) => Number.isFinite(Number(bytes)) && Number(bytes) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]));

    const total = entries.reduce((sum, [, bytes]) => sum + Number(bytes), 0);

    if (!entries.length || total <= 0) {
        elements.languageBars.innerHTML = "";
        elements.languagesEmpty.classList.remove("hidden");
        return;
    }

    elements.languageBars.innerHTML = entries.map(([name, bytes]) => {
        const percentage = (Number(bytes) / total) * 100;
        return `
            <div class="language-row">
                <div class="language-label">
                    <span>${escapeHTML(name)}</span>
                    <span>${percentage.toFixed(1)}%</span>
                </div>
                <div class="bar-track" aria-label="${escapeAttr(name)} ${percentage.toFixed(1)} percent">
                    <div class="bar-fill" style="width:${percentage.toFixed(2)}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

async function loadActivity(owner, repo, cache) {
    elements.activityLoading.classList.remove("hidden");
    elements.activityError.classList.add("hidden");
    elements.activityEmpty.classList.add("hidden");
    elements.activityChartWrap.classList.add("hidden");

    if (cache.activity) {
        renderActivity(cache.activity);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/commit_activity`, {
            headers: { Accept: "application/vnd.github+json" }
        });

        updateRateStatus(response);

        if (response.status === 202) {
            throw new Error("GitHub is still generating commit statistics. Please try again shortly.");
        }
        if (!response.ok) {
            throw await createApiError(response);
        }

        const data = await response.json();
        cache.activity = Array.isArray(data) ? data : [];
        renderActivity(cache.activity);
    } catch (error) {
        showSectionError(elements.activityLoading, elements.activityError, friendlyError(error));
    }
}

function renderActivity(activity) {
    elements.activityLoading.classList.add("hidden");

    if (!Array.isArray(activity) || activity.length === 0 || activity.every((week) => Number(week.total) === 0)) {
        elements.activityChartWrap.classList.add("hidden");
        elements.activityEmpty.classList.remove("hidden");
        return;
    }

    elements.activityEmpty.classList.add("hidden");
    elements.activityError.classList.add("hidden");
    elements.activityChartWrap.classList.remove("hidden");
    state.currentRepo.activity = activity;
    drawActivityChart(activity);
}

function drawActivityChart(activity) {
    const canvas = elements.activityChart;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || 600));
    const height = 230;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const values = activity.map((week) => Math.max(0, Number(week.total) || 0));
    const max = Math.max(...values, 1);
    const pad = { top: 14, right: 10, bottom: 22, left: 34 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.fillStyle = "#66738f";

    for (let i = 0; i <= 3; i++) {
        const value = Math.round((max / 3) * i);
        const y = pad.top + chartH - (chartH * i / 3);
        ctx.fillText(String(value), pad.left - 8, y + 4);
        ctx.strokeStyle = "rgba(148,163,184,.09)";
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
    }

    const step = chartW / Math.max(values.length - 1, 1);
    const points = values.map((value, index) => ({
        x: pad.left + index * step,
        y: pad.top + chartH - (value / max) * chartH
    }));

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height);
    gradient.addColorStop(0, "rgba(139,92,246,.42)");
    gradient.addColorStop(1, "rgba(139,92,246,0)");

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points.at(-1).x, pad.top + chartH);
    ctx.lineTo(points[0].x, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.stroke();

    points.forEach((point, index) => {
        if (index % Math.max(1, Math.floor(points.length / 18)) !== 0 && index !== points.length - 1) return;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#c4b5fd";
        ctx.fill();
    });
}

async function loadContributors(owner, repo, cache) {
    elements.contributorsLoading.classList.remove("hidden");
    elements.contributorsError.classList.add("hidden");
    elements.contributorsEmpty.classList.add("hidden");
    elements.contributorsGrid.innerHTML = "";

    if (cache.contributors) {
        renderContributors(cache.contributors);
        return;
    }

    try {
        const contributors = [];
        const maxPages = 2;

        for (let page = 1; page <= maxPages; page++) {
            const data = await apiFetch(
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100&page=${page}`,
                { signal: createController() }
            );

            if (!Array.isArray(data) || data.length === 0) break;
            contributors.push(...data);

            if (data.length < 100) break;
        }

        contributors.sort((a, b) => (Number(b.contributions) || 0) - (Number(a.contributions) || 0));
        cache.contributors = contributors.slice(0, 20);
        renderContributors(cache.contributors);
    } catch (error) {
        showSectionError(elements.contributorsLoading, elements.contributorsError, friendlyError(error));
    }
}

function renderContributors(contributors) {
    elements.contributorsLoading.classList.add("hidden");

    if (!Array.isArray(contributors) || contributors.length === 0) {
        elements.contributorsEmpty.classList.remove("hidden");
        elements.contributorCount.textContent = "";
        return;
    }

    elements.contributorsEmpty.classList.add("hidden");
    elements.contributorCount.textContent = `Top ${contributors.length}`;

    elements.contributorsGrid.innerHTML = contributors.map((person) => `
        <a class="contributor" href="${escapeAttr(person.html_url || "#")}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(person.login || "Contributor")}">
            <img src="${escapeAttr(person.avatar_url || fallbackAvatar(person.login))}" alt="${escapeAttr(person.login || "Contributor")} avatar" loading="lazy">
            <span class="contributor-name">${escapeHTML(person.login || "Unknown")}</span>
            <span class="contribution-count">${formatNumber(person.contributions)} contributions</span>
        </a>
    `).join("");
}

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Accept: "application/vnd.github+json",
            ...options.headers
        }
    });

    updateRateStatus(response);

    if (!response.ok) {
        throw await createApiError(response);
    }

    return response.json();
}

async function createApiError(response) {
    let message = "";

    try {
        const body = await response.json();
        message = body?.message || "";
    } catch (_) {}

    const error = new Error(message || `GitHub request failed with status ${response.status}`);
    error.status = response.status;

    if (response.status === 403 && /rate limit/i.test(message || "") || response.status === 429) {
        error.code = "RATE_LIMIT";
    }

    return error;
}

function updateRateStatus(response) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const limit = response.headers.get("X-RateLimit-Limit");

    if (remaining !== null && limit !== null) {
        elements.apiStatusText.textContent = `${remaining}/${limit} API requests left`;
    }

    if (response.status === 403 || response.status === 429) {
        elements.apiStatus.classList.add("warn");
    } else if (response.ok) {
        elements.apiStatus.classList.remove("warn", "error");
        elements.apiStatus.classList.add("ok");
    }
}

function friendlyError(error) {
    if (error?.code === "RATE_LIMIT") {
        return "GitHub API rate limit reached. Please wait and try again later.";
    }

    switch (error?.status) {
        case 404:
            return "Repository not found. It may be private, deleted, or the owner/repository name is incorrect.";
        case 422:
            return "GitHub could not process that request. Try a simpler search query.";
        case 500:
        case 502:
        case 503:
            return "GitHub is temporarily unavailable. Please try again in a moment.";
        default:
            if (error?.message?.includes("Failed to fetch")) {
                return "Unable to connect to GitHub. Check your internet connection and try again.";
            }
            return error?.message || "Something went wrong while contacting GitHub.";
    }
}

function createController() {
    const controller = new AbortController();
    state.controllers.add(controller);
    return controller.signal;
}

function cancelRequests() {
    state.controllers.forEach((controller) => controller.abort());
    state.controllers.clear();
}

function setSearchLoading(loading) {
    elements.searchBtn.disabled = loading;
    elements.searchSpinner.classList.toggle("hidden", !loading);
    elements.searchBtnText.textContent = loading ? "Searching" : "Search";
    elements.resultsLoading.classList.toggle("hidden", !loading);
}

function clearResultsState() {
    elements.resultsError.classList.add("hidden");
    elements.resultsEmpty.classList.add("hidden");
    elements.resultsGrid.innerHTML = "";
}

function updatePagination() {
    const totalPages = Math.min(Math.ceil(state.totalCount / state.perPage), 10);
    const canPaginate = totalPages > 1;

    elements.pagination.classList.toggle("hidden", !canPaginate);
    elements.pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
    elements.prevPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= totalPages;
}

function changePage(page) {
    const totalPages = Math.min(Math.ceil(state.totalCount / state.perPage), 10);
    if (page < 1 || page > totalPages) return;
    searchRepositories(state.query, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSearch() {
    cancelRequests();
    elements.searchView.classList.remove("hidden");
    elements.resultsView.classList.add("hidden");
    elements.repositoryView.classList.add("hidden");
}

function showResults() {
    cancelRequests();
    elements.searchView.classList.add("hidden");
    elements.resultsView.classList.remove("hidden");
    elements.repositoryView.classList.add("hidden");
}

function showRepositoryView() {
    cancelRequests();
    elements.searchView.classList.add("hidden");
    elements.resultsView.classList.add("hidden");
    elements.repositoryView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetDetailSections() {
    elements.languagesLoading.classList.remove("hidden");
    elements.languagesError.classList.add("hidden");
    elements.languagesEmpty.classList.add("hidden");
    elements.languageBars.innerHTML = "";

    elements.activityLoading.classList.remove("hidden");
    elements.activityError.classList.add("hidden");
    elements.activityEmpty.classList.add("hidden");
    elements.activityChartWrap.classList.add("hidden");

    elements.contributorsLoading.classList.remove("hidden");
    elements.contributorsError.classList.add("hidden");
    elements.contributorsEmpty.classList.add("hidden");
    elements.contributorsGrid.innerHTML = "";
    elements.contributorCount.textContent = "";
}

function setSectionLoading(loading, error, empty, content) {
    loading.classList.remove("hidden");
    error.classList.add("hidden");
    empty.classList.add("hidden");
    content.innerHTML = "";
}

function showSectionError(loading, error, message) {
    loading.classList.add("hidden");
    error.textContent = message;
    error.classList.remove("hidden");
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function formatRelativeDate(value) {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "unknown";

    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function fallbackAvatar(name = "github") {
    return `https://github.com/${encodeURIComponent(name)}.png?size=96`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHTML(value);
}

function debounce(fn, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}
