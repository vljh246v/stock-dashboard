import { describe, expect, it, vi, beforeEach } from "vitest";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// Mock the LLM invocation to capture the prompt
let capturedMessages: any[] = [];
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock DB cache to always miss
vi.mock("./db", () => ({
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
}));

import { generateSentimentAnalysis, translateBusinessSummary } from "./llmAnalysis";

const mockSentimentResponse = () => {
  vi.mocked(invokeLLM).mockImplementation(async ({ messages }: any) => {
    capturedMessages = messages;
    return {
      choices: [{
        message: {
          content: JSON.stringify({
            overallSentiment: "긍정",
            sentimentScore: 72,
            newsAnalysis: [
              { headline: "테스트 뉴스", sentiment: "긍정", impact: "긍정적 영향" },
            ],
            marketImpact: "시장에 긍정적인 영향을 미칩니다.",
          }),
        },
      }],
    } as any;
  });
};

describe("generateSentimentAnalysis - insights data handling", () => {
  beforeEach(() => {
    capturedMessages = [];
    vi.clearAllMocks();
    mockSentimentResponse();
  });

  it("correctly unwraps finance.result wrapper from insights data", async () => {
    const insightsData = {
      finance: {
        result: {
          sigDevs: [
            { headline: "Apple beats Q2 earnings expectations", date: "2024-05-01" },
          ],
          reports: [
            {
              tickers: ["AAPL"],
              headHtml: "Apple's strong iPhone sales drive revenue growth",
              reportDate: "2024-04-30",
              provider: "Goldman Sachs",
            },
          ],
        },
      },
    };

    const result = await generateSentimentAnalysis("AAPL", insightsData);
    expect(result).toBeDefined();
    expect(result.sentimentScore).toBe(72);
    expect(result.overallSentiment).toBe("긍정");

    // Check that the user prompt contains actual news data
    const userPrompt = capturedMessages.find((m: any) => m.role === "user")?.content || "";
    expect(userPrompt).toContain("AAPL");
    expect(userPrompt).toContain("Apple beats Q2 earnings");
  });

  it("filters reports by ticker symbol for unique per-stock sentiment", async () => {
    const insightsData = {
      finance: {
        result: {
          sigDevs: [],
          reports: [
            {
              tickers: ["MSFT"],
              headHtml: "Microsoft Azure cloud growth accelerates",
              reportDate: "2024-04-28",
              provider: "Morgan Stanley",
            },
            {
              tickers: ["AAPL"],
              headHtml: "Apple iPhone sales disappoint in China",
              reportDate: "2024-04-29",
              provider: "JPMorgan",
            },
            {
              tickers: ["AAPL", "MSFT"],
              headHtml: "Tech sector outlook positive",
              reportDate: "2024-04-30",
              provider: "Barclays",
            },
          ],
        },
      },
    };

    await generateSentimentAnalysis("MSFT", insightsData);
    const userPrompt = capturedMessages.find((m: any) => m.role === "user")?.content || "";
    // MSFT-specific report should be included
    expect(userPrompt).toContain("Microsoft Azure");
    // AAPL-only report should NOT be included
    expect(userPrompt).not.toContain("Apple iPhone sales disappoint");
    // Report with both tickers should be included
    expect(userPrompt).toContain("Tech sector outlook");
  });

  it("returns noData when no news items are available", async () => {
    const insightsData = {
      finance: {
        result: {
          sigDevs: [],
          reports: [],
        },
      },
    };

    const result = await generateSentimentAnalysis("EMPTY", insightsData);
    expect(result).toBeDefined();
    expect(result.noData).toBe(true);
    expect(result.sentimentScore).toBeNull();
  });

  it("handles already-unwrapped insights data gracefully", async () => {
    const insightsData = {
      sigDevs: [
        { headline: "Microsoft announces new AI features", date: "2024-05-02" },
      ],
      reports: [
        {
          tickers: ["MSFT"],
          headHtml: "MSFT revenue beats estimates",
          reportDate: "2024-05-01",
          provider: "UBS",
        },
      ],
    };

    const result = await generateSentimentAnalysis("MSFT", insightsData);
    expect(result).toBeDefined();
    expect(result.sentimentScore).toBe(72);
  });

  it("formats non-string reportDate values from real Yahoo insights data", async () => {
    const insightsData = {
      finance: {
        result: {
          sigDevs: [],
          reports: [
            {
              tickers: ["AAPL"],
              headHtml: "Apple report with object date",
              reportDate: { raw: 1714348800, fmt: "2024-04-29" },
              provider: "Yahoo Finance",
            },
          ],
        },
      },
    };

    const result = await generateSentimentAnalysis("AAPL", insightsData);
    const userPrompt = capturedMessages.find((m: any) => m.role === "user")?.content || "";

    expect(result.sentimentScore).toBe(72);
    expect(userPrompt).toContain("Apple report with object date");
    expect(userPrompt).toContain("2024-04-29");
  });

  it("handles null/undefined insights data without crashing", async () => {
    const result = await generateSentimentAnalysis("UNKNOWN", null);
    expect(result).toBeDefined();
    expect(result.noData).toBe(true);
  });
});

describe("translateBusinessSummary", () => {
  beforeEach(() => {
    capturedMessages = [];
    vi.clearAllMocks();
    vi.mocked(db.getCachedData).mockResolvedValue(null);
    vi.mocked(db.setCachedData).mockResolvedValue(undefined);
    vi.mocked(invokeLLM).mockImplementation(async ({ messages }: any) => {
      capturedMessages = messages;
      return {
        choices: [{
          message: { content: "애플은 아이폰, 맥, 아이패드를 설계하고 제조합니다." },
        }],
      } as any;
    });
  });

  it("translates English summary to Korean", async () => {
    const result = await translateBusinessSummary("AAPL", "Apple designs and manufactures iPhone, Mac, iPad.");
    expect(result).toBe("애플은 아이폰, 맥, 아이패드를 설계하고 제조합니다.");
  });

  it("returns empty string for empty input", async () => {
    const result = await translateBusinessSummary("AAPL", "");
    expect(result).toBe("");
  });

  it("does not expose English fallback when translation fails", async () => {
    vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("OPENAI_API_KEY is not configured"));

    const result = await translateBusinessSummary("AAPL", "Apple designs and manufactures iPhone, Mac, iPad.");

    expect(result).toBe("");
  });

  it("does not accept an English-only LLM response as translated summary", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{
        message: { content: "Apple designs and manufactures iPhone, Mac, iPad." },
      }],
    } as any);

    const result = await translateBusinessSummary("AAPL", "Apple designs and manufactures iPhone, Mac, iPad.");

    expect(result).toBe("");
    expect(db.setCachedData).not.toHaveBeenCalled();
  });

  it("uses a cached Korean summary", async () => {
    vi.mocked(db.getCachedData).mockResolvedValueOnce("애플은 아이폰, 맥, 아이패드를 설계하고 제조합니다.");

    const result = await translateBusinessSummary("AAPL", "Apple designs and manufactures iPhone, Mac, iPad.");

    expect(result).toBe("애플은 아이폰, 맥, 아이패드를 설계하고 제조합니다.");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
