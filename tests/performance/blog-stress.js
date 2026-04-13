import http from "k6/http";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const MODE = __ENV.STRESS_MODE || "users";

const usersOptions = {
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "min", "max"],
  scenarios: {
    mixed_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 5 },
        { duration: "2m", target: 5 },
        { duration: "2m", target: 10 },
        { duration: "2m", target: 20 },
        { duration: "2m", target: 40 },
        { duration: "2m", target: 80 },
        { duration: "2m", target: 120 },
        { duration: "2m", target: 160 },
        { duration: "2m", target: 200 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "mixedUserFlow",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.20"],
    checks: ["rate>0.80"],
  },
};

const endpointStages = [
  { target: 10, duration: "1m" },
  { target: 10, duration: "2m" },
  { target: 20, duration: "2m" },
  { target: 40, duration: "2m" },
  { target: 60, duration: "2m" },
  { target: 0, duration: "1m" },
];

const endpointExecMap = {
  login: "loginOnlyFlow",
  read: "readOnlyFlow",
  post: "createPostOnlyFlow",
  comment: "createCommentOnlyFlow",
};

const endpointOptions = {
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "min", "max"],
  scenarios: {
    endpoint_stress: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 200,
      stages: endpointStages,
      exec: endpointExecMap[MODE] || "loginOnlyFlow",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.20"],
    checks: ["rate>0.80"],
  },
};

export const options = MODE === "users" ? usersOptions : endpointOptions;

const scenarioDuration = new Trend("stress_scenario_duration", true);
const opDuration = new Trend("stress_operation_duration", true);
const scenarioSuccess = new Counter("stress_success");
const scenarioFailure = new Counter("stress_failure");
const scenarioSuccessRate = new Rate("stress_success_rate");
const errorByStatus = new Counter("stress_errors_by_status");

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
    errorByStatus.add(1, { status: String(response.status), label });
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

function recordResult(name, startedAt, ok) {
  const duration = Date.now() - startedAt;
  scenarioDuration.add(duration, { mode: MODE, flow: name });
  opDuration.add(duration, { mode: MODE, flow: name });
  if (ok) {
    scenarioSuccess.add(1, { mode: MODE, flow: name });
    scenarioSuccessRate.add(true, { mode: MODE, flow: name });
  } else {
    scenarioFailure.add(1, { mode: MODE, flow: name });
    scenarioSuccessRate.add(false, { mode: MODE, flow: name });
  }
}

function scenarioUser(users) {
  const index = exec.scenario.iterationInTest % users.length;
  return users[index];
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
  const ok = data.metrics.stress_success?.values?.count ?? 0;
  const failed = data.metrics.stress_failure?.values?.count ?? 0;

  const lines = [
    `k6 stress test summary (${MODE})`,
    `http requests: ${httpReqs}`,
    `http failure rate: ${(httpFailed * 100).toFixed(2)}%`,
    `successful operations: ${ok}`,
    `failed operations: ${failed}`,
    `http_req_duration: ${formatTrendMetric(data.metrics.http_req_duration)}`,
    `stress_operation_duration: ${formatTrendMetric(data.metrics.stress_operation_duration)}`,
  ];

  return {
    "tests/performance/results/k6-stress-summary.txt": `${lines.join("\n")}\n`,
    stdout: `${lines.join("\n")}\n`,
  };
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`);
  mustStatus(health, 200, "health check");

  const seedAuthor = registerUser(0, "k6-stress-seed-author");
  const seedToken = loginUser(seedAuthor);

  const firstPost = createPost(
    seedToken,
    "Stress seed post one",
    "Stress seed description one",
    "Stress seed content one"
  );
  const secondPost = createPost(
    seedToken,
    "Stress seed post two",
    "Stress seed description two",
    "Stress seed content two"
  );

  const users = {
    mixed: [
      registerUser(1, "k6-stress-mixed"),
      registerUser(2, "k6-stress-mixed"),
      registerUser(3, "k6-stress-mixed"),
      registerUser(4, "k6-stress-mixed"),
    ],
    login: [registerUser(5, "k6-stress-login")],
    read: [registerUser(6, "k6-stress-read")],
    post: [registerUser(7, "k6-stress-post")],
    comment: [registerUser(8, "k6-stress-comment")],
    posts: [firstPost.id, secondPost.id],
  };

  return users;
}

export default function () {}

export function mixedUserFlow(data) {
  const startedAt = Date.now();
  try {
    const user = scenarioUser(data.mixed);
    const flowIndex = exec.scenario.iterationInTest % 4;
    if (flowIndex === 0) {
      const token = loginUser(user);
      const posts = listPosts();
      const postId = posts[0]?.id || data.posts[0];
      getPost(postId);
      getProfile(token);
    } else if (flowIndex === 1) {
      const token = loginUser(user);
      const posts = listPosts();
      const postId = posts[0]?.id || data.posts[0];
      createComment(token, postId, user.displayName, `stress comment ${Date.now()}`);
    } else if (flowIndex === 2) {
      const token = loginUser(user);
      createPost(token, `stress title ${Date.now()}`, "stress desc", "stress body");
    } else {
      const token = loginUser(user);
      updateProfile(token, {
        firstName: "Stress",
        lastName: "User",
        age: 26,
        gender: "female",
        address: "Warsaw",
        website: "https://example.com",
        bio: `stress ${Date.now()}`,
        avatarUrl: "https://example.com/avatar.png",
      });
    }
    recordResult("mixed_users", startedAt, true);
  } catch (_err) {
    recordResult("mixed_users", startedAt, false);
    throw _err;
  }
  sleep(1);
}

export function loginOnlyFlow(data) {
  const startedAt = Date.now();
  try {
    const user = scenarioUser(data.login);
    loginUser(user);
    recordResult("login", startedAt, true);
  } catch (_err) {
    recordResult("login", startedAt, false);
    throw _err;
  }
}

export function readOnlyFlow(data) {
  const startedAt = Date.now();
  try {
    const user = scenarioUser(data.read);
    loginUser(user);
    const posts = listPosts();
    const postId = posts[0]?.id || data.posts[0];
    getPost(postId);
    recordResult("read", startedAt, true);
  } catch (_err) {
    recordResult("read", startedAt, false);
    throw _err;
  }
}

export function createPostOnlyFlow(data) {
  const startedAt = Date.now();
  try {
    const user = scenarioUser(data.post);
    const token = loginUser(user);
    createPost(token, `stress title ${Date.now()}`, "stress desc", "stress body");
    recordResult("post", startedAt, true);
  } catch (_err) {
    recordResult("post", startedAt, false);
    throw _err;
  }
}

export function createCommentOnlyFlow(data) {
  const startedAt = Date.now();
  try {
    const user = scenarioUser(data.comment);
    const token = loginUser(user);
    const posts = listPosts();
    const postId = posts[0]?.id || data.posts[0];
    createComment(token, postId, user.displayName, `stress comment ${Date.now()}`);
    recordResult("comment", startedAt, true);
  } catch (_err) {
    recordResult("comment", startedAt, false);
    throw _err;
  }
}
