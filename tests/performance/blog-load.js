import http from "k6/http";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SCENARIO_DURATION = __ENV.SCENARIO_DURATION || "5m";

export const options = {
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "min", "max"],
  scenarios: {
    login_read_post_logout: {
      executor: "constant-vus",
      vus: 2,
      duration: SCENARIO_DURATION,
      exec: "loginReadPostLogout",
    },
    login_read_comment_logout: {
      executor: "constant-vus",
      vus: 1,
      duration: SCENARIO_DURATION,
      exec: "loginReadAnotherCommentLogout",
    },
    login_create_post_logout: {
      executor: "constant-vus",
      vus: 1,
      duration: SCENARIO_DURATION,
      exec: "loginCreatePostLogout",
    },
    login_update_profile_logout: {
      executor: "constant-vus",
      vus: 1,
      duration: SCENARIO_DURATION,
      exec: "loginUpdateProfileLogout",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.95"],
    http_req_duration: ["p(95)<1500"],
    scenario_duration: ["p(95)<4000"],
    scenario_success_rate: ["rate>0.95"],
  },
};

const scenarioDuration = new Trend("scenario_duration", true);
const readPostDuration = new Trend("scenario_read_post_duration", true);
const readCommentDuration = new Trend("scenario_read_comment_duration", true);
const createPostDuration = new Trend("scenario_create_post_duration", true);
const updateProfileDuration = new Trend("scenario_update_profile_duration", true);
const scenarioSuccess = new Counter("scenario_success");
const scenarioFailure = new Counter("scenario_failure");
const scenarioSuccessRate = new Rate("scenario_success_rate");

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { headers };
}

function parseJSON(response) {
  try {
    return response.json();
  } catch (_err) {
    return null;
  }
}

function mustStatus(response, expected, label) {
  const ok = check(response, {
    [`${label} status is ${expected}`]: (r) => r.status === expected,
  });
  if (!ok) {
    fail(`${label} failed with status ${response.status}: ${response.body}`);
  }
}

function uniqueSuffix(prefix, index) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function registerUser(index, prefix) {
  const suffix = uniqueSuffix(prefix, index);
  const email = `${suffix}@example.com`;
  const password = "Asdf@1234";
  const displayName = suffix.replace(/[^a-zA-Z0-9_]/g, "_");
  const response = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email, password, displayName }),
    jsonHeaders()
  );
  mustStatus(response, 201, `register ${displayName}`);
  const body = parseJSON(response);
  return {
    email,
    password,
    displayName,
    token: body.token,
    userId: body.user.id,
  };
}

function loginUser(user) {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: user.displayName, password: user.password }),
    jsonHeaders()
  );
  mustStatus(response, 200, `login ${user.displayName}`);
  return parseJSON(response).token;
}

function listPosts() {
  const response = http.get(`${BASE_URL}/api/posts`);
  mustStatus(response, 200, "list posts");
  return parseJSON(response);
}

function getPost(postId) {
  const response = http.get(`${BASE_URL}/api/posts/${postId}`);
  mustStatus(response, 200, `get post ${postId}`);
  return parseJSON(response);
}

function createPost(token, title, description, body) {
  const response = http.post(
    `${BASE_URL}/api/posts`,
    JSON.stringify({ title, description, body }),
    jsonHeaders(token)
  );
  mustStatus(response, 201, "create post");
  return parseJSON(response);
}

function createComment(token, postId, name, message) {
  const response = http.post(
    `${BASE_URL}/api/posts/${postId}/comments`,
    JSON.stringify({ name, message }),
    jsonHeaders(token)
  );
  mustStatus(response, 201, `create comment for post ${postId}`);
  return parseJSON(response);
}

function getProfile(token) {
  const response = http.get(`${BASE_URL}/api/profile/me`, jsonHeaders(token));
  mustStatus(response, 200, "get profile");
  return parseJSON(response);
}

function updateProfile(token, payload) {
  const response = http.put(
    `${BASE_URL}/api/profile/me`,
    JSON.stringify(payload),
    jsonHeaders(token)
  );
  mustStatus(response, 200, "update profile");
  return parseJSON(response);
}

function scenarioUser(users) {
  const index = exec.scenario.iterationInTest % users.length;
  return users[index];
}

function logoutUser(_token) {
  return null;
}

function runScenario(name, trend, fn) {
  const startedAt = Date.now();
  try {
    fn();
    const duration = Date.now() - startedAt;
    scenarioDuration.add(duration, { scenario: name });
    trend.add(duration, { scenario: name });
    scenarioSuccess.add(1, { scenario: name });
    scenarioSuccessRate.add(true, { scenario: name });
  } catch (error) {
    const duration = Date.now() - startedAt;
    scenarioDuration.add(duration, { scenario: name });
    trend.add(duration, { scenario: name });
    scenarioFailure.add(1, { scenario: name });
    scenarioSuccessRate.add(false, { scenario: name });
    throw error;
  }
}

function formatTrendMetric(metric) {
  if (!metric || !metric.values) {
    return "n/a";
  }
  const values = metric.values;
  return [
    `avg=${values.avg?.toFixed?.(2) ?? "n/a"}ms`,
    `med=${values.med?.toFixed?.(2) ?? "n/a"}ms`,
    `p95=${values["p(95)"]?.toFixed?.(2) ?? "n/a"}ms`,
    `p99=${values["p(99)"]?.toFixed?.(2) ?? "n/a"}ms`,
  ].join(", ");
}

export function handleSummary(data) {
  const httpFailed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const httpReqs = data.metrics.http_reqs?.values?.count ?? 0;
  const scenarioOk = data.metrics.scenario_success?.values?.count ?? 0;
  const scenarioFailed = data.metrics.scenario_failure?.values?.count ?? 0;

  const lines = [
    "k6 load test summary",
    `http requests: ${httpReqs}`,
    `http failure rate: ${(httpFailed * 100).toFixed(2)}%`,
    `successful scenarios: ${scenarioOk}`,
    `failed scenarios: ${scenarioFailed}`,
    `http_req_duration: ${formatTrendMetric(data.metrics.http_req_duration)}`,
    `scenario_duration: ${formatTrendMetric(data.metrics.scenario_duration)}`,
    `read post scenario: ${formatTrendMetric(data.metrics.scenario_read_post_duration)}`,
    `read/comment scenario: ${formatTrendMetric(data.metrics.scenario_read_comment_duration)}`,
    `create post scenario: ${formatTrendMetric(data.metrics.scenario_create_post_duration)}`,
    `update profile scenario: ${formatTrendMetric(data.metrics.scenario_update_profile_duration)}`,
  ];

  return {
    "tests/performance/results/k6-summary.txt": `${lines.join("\n")}\n`,
    stdout: `${lines.join("\n")}\n`,
  };
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`);
  mustStatus(health, 200, "health check");

  const seedAuthor = registerUser(0, "k6-seed-author");
  const seedToken = loginUser(seedAuthor);
  const firstPost = createPost(
    seedToken,
    "Seed post one",
    "Seed description one",
    "Seed content one"
  );
  const secondPost = createPost(
    seedToken,
    "Seed post two",
    "Seed description two",
    "Seed content two"
  );

  const users = {
    read: [registerUser(1, "k6-read"), registerUser(2, "k6-read")],
    comment: [registerUser(3, "k6-comment")],
    create: [registerUser(4, "k6-create")],
    profile: [registerUser(5, "k6-profile")],
  };

  return {
    posts: [firstPost.id, secondPost.id],
    users,
  };
}

export default function () {}

export function loginReadPostLogout(data) {
  runScenario("login_read_post_logout", readPostDuration, () => {
    const user = scenarioUser(data.users.read);
    let token = loginUser(user);

    const posts = listPosts();
    check(posts, {
      "posts list contains at least one post": (items) => Array.isArray(items) && items.length > 0,
    });
    const postId = posts[0]?.id || data.posts[0];
    const fullPost = getPost(postId);
    check(fullPost, {
      "full post response contains post": (payload) => payload && payload.post && payload.post.id === postId,
    });

    token = logoutUser(token);
    check(token, { "logout clears token": (value) => value === null });
    sleep(1);
  });
}

export function loginReadAnotherCommentLogout(data) {
  runScenario("login_read_comment_logout", readCommentDuration, () => {
    const user = scenarioUser(data.users.comment);
    let token = loginUser(user);

    const posts = listPosts();
    check(posts, {
      "posts list contains at least two posts": (items) => Array.isArray(items) && items.length >= 2,
    });

    const firstPostId = posts[0]?.id || data.posts[0];
    const secondPostId = posts[1]?.id || data.posts[1];

    getPost(firstPostId);
    listPosts();
    getPost(secondPostId);
    createComment(
      token,
      secondPostId,
      user.displayName,
      `k6 comment ${Date.now()}`
    );

    token = logoutUser(token);
    check(token, { "logout clears token": (value) => value === null });
    sleep(1);
  });
}

export function loginCreatePostLogout(data) {
  runScenario("login_create_post_logout", createPostDuration, () => {
    const user = scenarioUser(data.users.create);
    let token = loginUser(user);

    const post = createPost(
      token,
      `k6 post ${Date.now()}`,
      `k6 description ${Date.now()}`,
      `k6 content ${Date.now()}`
    );
    check(post, {
      "created post has id": (payload) => payload && payload.id > 0,
    });

    token = logoutUser(token);
    check(token, { "logout clears token": (value) => value === null });
    sleep(1);
  });
}

export function loginUpdateProfileLogout(data) {
  runScenario("login_update_profile_logout", updateProfileDuration, () => {
    const user = scenarioUser(data.users.profile);
    let token = loginUser(user);

    const profile = getProfile(token);
    check(profile, {
      "profile response contains id": (payload) => payload && payload.id > 0,
    });

    const updated = updateProfile(token, {
      firstName: "Load",
      lastName: "Tester",
      age: 24,
      gender: "female",
      address: "Warsaw",
      website: "https://example.com",
      bio: `Updated by k6 ${Date.now()}`,
      avatarUrl: "https://example.com/avatar.png",
    });
    check(updated, {
      "profile was updated": (payload) => payload && payload.firstName === "Load" && payload.lastName === "Tester",
    });

    token = logoutUser(token);
    check(token, { "logout clears token": (value) => value === null });
    sleep(1);
  });
}
