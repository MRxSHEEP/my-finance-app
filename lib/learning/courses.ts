import type { Course } from "./types";

// Every course follows the same 6 content slides + 3 quizzes (after slide 2,
// after slide 4, and at the end) shape, so the hub's progress math and the
// course player's slide-index logic can stay uniform across all 12 topics:
// content, content, quiz, content, content, quiz, content, content, quiz
// (9 total slides per course). Quiz answer order is shuffled per question
// so the correct option isn't predictably in the same position.
export const COURSES: Course[] = [
  {
    "topicId": "pe-ratio",
    "title": "P/E Ratio",
    "descriptor": "Pricing vs. profit",
    "slides": [
      {
        "type": "content",
        "title": "What Does P/E Actually Mean?",
        "body": [
          "The price-to-earnings ratio, or P/E, is one of the most quoted numbers in investing — and one of the simplest.",
          "It answers one question: how much are investors paying today for each dollar of a company's annual [[profit|earnings]]?",
          "A P/E of 20 means the market values the company at 20 times its yearly earnings — put another way, if that profit stayed exactly flat forever, it would take 20 years of earnings to 'pay back' today's share price.",
          "The ratio exists because a raw share price on its own is meaningless for comparison — a $400 stock isn't automatically 'more expensive' than a $40 one, since share count is arbitrary. Dividing price by earnings gives a size-independent number that can be compared across companies of wildly different scale."
        ]
      },
      {
        "type": "content",
        "title": "Why Investors Watch It",
        "body": [
          "P/E is a fast way to gauge whether a stock looks expensive or cheap relative to its own profits.",
          "It's the single most common starting point analysts use before digging into anything else — a first-pass filter, not a final verdict, before moving on to a fuller model.",
          "Because it's so widely quoted, it also shapes market sentiment — a rising P/E often signals growing optimism about a company's future, and a falling one often signals the opposite, sometimes before the underlying business has actually changed at all.",
          "In professional practice, P/E rarely gets judged in isolation. Analysts build a company's own historical P/E range and compare it against direct competitors in the same industry — a P/E that looks high in a vacuum can be perfectly ordinary once benchmarked against peers trading at similar multiples."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does the P/E ratio measure?",
              "options": [
                "The company's total revenue",
                "How much cash a company has on hand",
                "The number of shares outstanding",
                "How much investors pay per dollar of annual profit"
              ],
              "correctIndex": 3,
              "explanation": "P/E divides share price by earnings per share, showing how much investors pay for each dollar of profit."
            },
            {
              "question": "A P/E of 20 means investors are paying how much per $1 of earnings?",
              "options": [
                "$2",
                "$0.20",
                "$200",
                "$20"
              ],
              "correctIndex": 3,
              "explanation": "By definition, a P/E of 20 means the price is 20 times the per-share earnings."
            },
            {
              "question": "Why do investors commonly check a stock's P/E ratio?",
              "options": [
                "It's a quick way to gauge if a stock looks expensive or cheap relative to profits",
                "It replaces the need for any other research",
                "It shows the exact future stock price",
                "It guarantees a certain dividend payment"
              ],
              "correctIndex": 0,
              "explanation": "P/E is a fast first read on valuation — a starting point, not the final word."
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "P/E Ratio = Share Price ÷ Earnings Per Share (EPS).",
          "You can also flip it around: Share Price = P/E × EPS — useful for estimating a 'fair' price if you have a target multiple in mind, and exactly how analysts translate an estimated future EPS into a projected price target.",
          "There are two common variants: [[trailing P/E|trailing-pe]] (last 12 months of actual earnings) and [[forward P/E|forward-pe]] (next year's estimated earnings). Forward P/E is what most professional research actually quotes day to day, since markets price in expectations, not just the past — but it's only as reliable as the earnings estimate behind it."
        ],
        "formula": {
          "terms": [
            { "symbol": "Price", "meaning": "Current share price", "color": "blue" },
            { "symbol": "EPS", "meaning": "Earnings per share", "color": "purple" }
          ],
          "operators": ["÷"],
          "result": { "symbol": "P/E", "meaning": "Price-to-earnings ratio", "color": "blue" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Say a company trades at $60 per share and earned $3.00 per share over the last year.",
          "P/E = $60 ÷ $3.00 = 20.",
          "That means investors are currently paying $20 for every $1 of the company's annual profit — a figure that only becomes meaningful once it's placed next to something else to compare against, which is exactly what the next few slides do."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the formula for P/E ratio?",
              "options": [
                "Net Income ÷ Revenue",
                "Share Price ÷ Earnings Per Share",
                "Earnings Per Share ÷ Share Price",
                "Share Price × Shares Outstanding"
              ],
              "correctIndex": 1,
              "explanation": "P/E = Share Price ÷ EPS."
            },
            {
              "question": "A stock trades at $80 with EPS of $4. What's its P/E?",
              "options": [
                "40",
                "20",
                "4",
                "10"
              ],
              "correctIndex": 1,
              "explanation": "$80 ÷ $4 = 20."
            },
            {
              "question": "What's the difference between trailing and forward P/E?",
              "options": [
                "Trailing uses revenue; forward uses profit",
                "There is no difference",
                "Forward P/E only applies to bonds",
                "Trailing uses past 12 months' earnings; forward uses estimated future earnings"
              ],
              "correctIndex": 3,
              "explanation": "Trailing looks backward at actuals; forward looks ahead at estimates."
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Number",
        "body": [
          "A P/E only means something in context — comparing it to the company's own history, or to similar companies in the same industry.",
          "Fast-growing tech companies routinely trade at P/Es of 30-50+, while mature banks or utilities often sit closer to 10-15 — the illustrative spread below is roughly what that looks like across a handful of typical sectors today.",
          "A high P/E can mean the market expects strong future growth; a low P/E can mean it expects earnings to decline — it isn't automatically 'expensive' or 'cheap' on its own. This is the single most common misreading of the ratio: treating a bare number as a verdict rather than a starting question."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Illustrative P/E ranges by sector (typical, not any specific company)",
          "unit": "x",
          "bars": [
            { "label": "Utility", "value": 13 },
            { "label": "Bank", "value": 11 },
            { "label": "Retailer", "value": 18 },
            { "label": "Software", "value": 32 }
          ]
        }
      },
      {
        "type": "content",
        "title": "Where P/E Falls Short",
        "body": [
          "P/E is meaningless for companies with zero or negative earnings — you can't divide by a loss in any useful way.",
          "It ignores debt entirely, so two companies with the same P/E can carry very different financial risk. It also says nothing about growth rate — exactly the gap the [[PEG ratio|peg-ratio]] was built to fill.",
          "Perhaps the clearest illustration of what happens when a P/E gets divorced from any reasonable connection to underlying earnings is the dot-com era, in the case study below."
        ],
        "deepDive": {
          "title": "The professional variant: CAPE",
          "body": [
            "A single year's P/E can be distorted by a temporary earnings spike or slump — a company having an unusually good or bad year looks artificially cheap or expensive even if nothing structural has changed.",
            "The [[CAPE ratio|cape-ratio]] (cyclically-adjusted P/E, popularized by economist Robert Shiller) smooths this out by dividing price by the average of 10 years of inflation-adjusted earnings instead of just the trailing 12 months.",
            "It's used less for valuing individual stocks and more for gauging whether an entire market — like the S&P 500 — looks historically expensive or cheap relative to its own long-run earnings power."
          ]
        },
        "caseStudy": {
          "title": "Cisco Systems and the dot-com bubble (2000)",
          "body": [
            "In March 2000, at the height of the dot-com bubble, networking-equipment maker Cisco Systems reached an all-time high of about $82 per share, valuing the company at roughly half a trillion dollars — briefly the most valuable company in the world.",
            "At that peak, Cisco was selling for about 165 times earnings — the company had earned around $2.7 billion that year, meaning investors were paying roughly $165 for every $1 of annual profit, far outside any historical range for a large, established company.",
            "The business itself wasn't a fraud or a failure — Cisco's earnings actually grew roughly sevenfold in the following two decades. But the 2000 price had priced in a pace of growth the business could never realistically sustain. The result: more than two decades later, Cisco's stock still hadn't meaningfully exceeded its dot-com-era high, and investors who bought at the peak had earned a total return of only about 29% by the early 2020s — a poor result stretched across more than 20 years.",
            "The lesson isn't 'high P/E always means crash' — plenty of high-P/E companies go on to grow into their valuations. It's that overpaying for future growth, even in a genuinely good business, can be costly to returns for a very long time."
          ],
          "source": "Dividend Growth Investor, 'Cisco Systems (CSCO): Lessons from the Dot-Com Bubble'",
          "sourceUrl": "https://www.dividendgrowthinvestor.com/2022/09/cisco-systems-csco-lessons-from-dot-com.html"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "Why might a fast-growing tech company have a much higher P/E than a utility company?",
              "options": [
                "The market is pricing in expectations of much faster future earnings growth",
                "Utilities never make a profit",
                "P/E doesn't apply to tech companies",
                "Tech companies always have less debt"
              ],
              "correctIndex": 0,
              "explanation": "Higher expected growth is the main reason the market tolerates a richer multiple."
            },
            {
              "question": "What's a key limitation of the P/E ratio?",
              "options": [
                "It only applies to bonds",
                "It always equals 1",
                "It doesn't work for companies with zero or negative earnings",
                "It can't be calculated for public companies"
              ],
              "correctIndex": 2,
              "explanation": "Dividing by zero or a loss produces a meaningless or undefined result."
            },
            {
              "question": "Which ratio was built specifically to account for a company's growth rate alongside its P/E?",
              "options": [
                "Beta",
                "EV/EBITDA",
                "PEG Ratio",
                "Dividend Yield"
              ],
              "correctIndex": 2,
              "explanation": "PEG divides P/E by the growth rate to adjust for how fast a company is growing."
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "peg-ratio",
    "title": "PEG Ratio",
    "descriptor": "Growth-adjusted value",
    "toolHref": "/tools/peg",
    "toolLabel": "PEG Ratio Calculator",
    "slides": [
      {
        "type": "content",
        "title": "What Is the PEG Ratio?",
        "body": [
          "The PEG ratio (price/earnings-to-growth) takes the [[P/E ratio|pe-ratio]] a step further by dividing it by a company's expected annual [[earnings|earnings]] growth rate.",
          "The idea: a high P/E is easier to justify if earnings are growing quickly. A P/E of 40 sounds expensive in isolation, but if that company is growing earnings 40% a year, it's on much sturdier ground than a P/E of 15 attached to a company barely growing at all.",
          "PEG exists specifically to answer the question P/E alone can't: not just 'is this expensive,' but 'is this expensive relative to how fast it's actually growing.'"
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "PEG lets you compare a fast-growing company and a slow-growing one on more equal footing than P/E alone allows.",
          "Two stocks can share the same P/E and still look very different once you account for how fast each is actually growing.",
          "It's a favorite tool of growth-oriented investors specifically because it resists the trap of dismissing every high-P/E stock as automatically overpriced — sometimes a rich multiple is genuinely earned by rich growth, and PEG is the quickest gut-check for which situation you're actually looking at."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does PEG stand for, conceptually?",
              "options": [
                "Profit/Equity Growth",
                "Performance/Earnings Gauge",
                "Price/Earnings-to-Growth",
                "Price/Equity Gain"
              ],
              "correctIndex": 2,
              "explanation": "PEG extends P/E by dividing it by the expected earnings growth rate."
            },
            {
              "question": "Why was PEG created?",
              "options": [
                "To measure dividend safety",
                "To adjust the P/E ratio for a company's expected growth rate",
                "To calculate enterprise value",
                "To replace market cap entirely"
              ],
              "correctIndex": 1,
              "explanation": "It's specifically a growth-adjusted version of P/E."
            },
            {
              "question": "PEG lets you fairly compare which two types of companies?",
              "options": [
                "A stock and a bond",
                "Two companies in different currencies",
                "A fast-growing company and a slow-growing company",
                "A public company and a private company"
              ],
              "correctIndex": 2,
              "explanation": "Adjusting for growth puts different growth profiles on more equal footing."
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "PEG = P/E Ratio ÷ Annual [[EPS|net-income]] Growth Rate (%).",
          "For example, a P/E of 30 divided by an expected growth rate of 30 gives a PEG of 1.",
          "The growth rate is almost always a forward-looking estimate (analysts' projected growth for the next 1-3 years, sometimes a longer-run estimate), not a historical figure — which is exactly where PEG's biggest weakness comes from, covered later in this course."
        ],
        "formula": {
          "terms": [
            { "symbol": "P/E", "meaning": "Price-to-earnings ratio", "color": "blue" },
            { "symbol": "Growth %", "meaning": "Expected annual EPS growth", "color": "green" }
          ],
          "operators": ["÷"],
          "result": { "symbol": "PEG", "meaning": "Growth-adjusted valuation", "color": "green" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Company A: P/E of 40, expected growth of 20% → PEG = 2.0.",
          "Company B: P/E of 25, expected growth of 25% → PEG = 1.0.",
          "Even though Company A's P/E looks less extreme in isolation, Company B actually looks more attractively valued once growth is factored in."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the PEG formula?",
              "options": [
                "P/E Ratio ÷ Annual Earnings Growth Rate",
                "P/E Ratio × Growth Rate",
                "Growth Rate ÷ P/E Ratio",
                "EPS ÷ Growth Rate"
              ],
              "correctIndex": 0,
              "explanation": "PEG = P/E ÷ growth rate."
            },
            {
              "question": "A company has a P/E of 30 and expected growth of 30%. What's its PEG?",
              "options": [
                "2.0",
                "1.0",
                "0.5",
                "30"
              ],
              "correctIndex": 1,
              "explanation": "30 ÷ 30 = 1.0."
            },
            {
              "question": "Company A: P/E 40, growth 20%. Company B: P/E 25, growth 25%. Which has the lower (more attractive) PEG?",
              "options": [
                "Company A",
                "Company B",
                "Cannot be determined",
                "They're equal"
              ],
              "correctIndex": 1,
              "explanation": "A: 40 ÷ 20 = 2.0. B: 25 ÷ 25 = 1.0 — B is lower."
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Number",
        "body": [
          "Rough rule of thumb: a PEG around 1 is often considered fairly valued relative to growth, below 1 potentially undervalued, above 2 potentially overvalued.",
          "Like any single ratio, this varies by industry and depends heavily on how reliable the growth estimate actually is."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Illustrative PEG values (rule-of-thumb bands, not any specific company)",
          "bars": [
            { "label": "Undervalued zone", "value": 0.7 },
            { "label": "Fairly valued", "value": 1.0 },
            { "label": "Getting rich", "value": 1.8 },
            { "label": "Overvalued zone", "value": 2.6 }
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "PEG depends entirely on a growth forecast, and forecasts are frequently wrong.",
          "A stock can look cheap on a PEG basis simply because analysts are projecting overly optimistic growth.",
          "Treat PEG as a quick sanity check on a P/E ratio, not a precise valuation tool — the case study below shows the philosophy at its best, from the investor most associated with it."
        ],
        "deepDive": {
          "title": "PEG works best as one filter among several",
          "body": [
            "Professional 'growth at a reasonable price' (GARP) investors rarely stop at PEG alone — they layer it with checks on debt levels, margin trends, and the quality/durability of the growth itself (is it from real demand, or from a one-off event or an acquisition?).",
            "A single year's growth rate can also be misleadingly high coming off a depressed prior year (a low base effect) — professionals often look at growth averaged over several years, not just the single upcoming year, to avoid PEG understating the true valuation."
          ]
        },
        "caseStudy": {
          "title": "Peter Lynch and Fidelity Magellan",
          "body": [
            "The PEG ratio is most closely associated with Peter Lynch, who ran Fidelity's Magellan Fund from 1977 to 1990. Over that span, Lynch delivered an average annual return of roughly 29%, nearly double the S&P 500's roughly 16% over the same period — turning an approximately $18 million fund into roughly $14 billion by the time he stepped down.",
            "Lynch's approach, often summarized as 'growth at a reasonable price' (GARP), centered on finding companies growing earnings at a healthy double-digit clip while trading at a P/E that didn't already fully price in that growth — in PEG terms, hunting for a ratio meaningfully below 1 rather than paying up for popular, already-recognized growth stories.",
            "His record is a real illustration of why PEG matters: it's not that low P/E is good and high P/E is bad, it's that the RIGHT price depends on the growth behind it — and a disciplined, repeatable process for finding that mismatch compounded into one of the best long-term track records in mutual fund history."
          ],
          "source": "Widely reported figures on Peter Lynch's 1977-1990 Magellan Fund tenure and GARP investing philosophy (e.g. FastGraphs, 'The PEG Ratio: Peter Lynch's Secret to 29% Annual Returns'; Validea's Guru Investor Blog on the Lynch P/E/Growth model)",
          "sourceUrl": "https://www.fastgraphs.com/blog/the-peg-ratio-peter-lynchs-secret-to-29-annual-returns-and-how-fast-graphs-makes-it-easy-to-use"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "Roughly, what PEG value is often considered 'fairly valued' relative to growth?",
              "options": [
                "Around 100",
                "Around 1",
                "Around 0",
                "Around 10"
              ],
              "correctIndex": 1
            },
            {
              "question": "What is the biggest weakness of the PEG ratio?",
              "options": [
                "It only works for bonds",
                "It ignores the share price completely",
                "It depends on a growth forecast, which is often wrong",
                "It can't be calculated for any company"
              ],
              "correctIndex": 2
            },
            {
              "question": "How should PEG best be treated?",
              "options": [
                "As a substitute for reading financial statements",
                "As a measure of dividend yield",
                "As the single definitive measure of value",
                "As a quick sanity check on a P/E ratio, not a precise valuation tool"
              ],
              "correctIndex": 3
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "eps",
    "title": "EPS",
    "descriptor": "Profit per share",
    "slides": [
      {
        "type": "content",
        "title": "What Is EPS?",
        "body": [
          "Earnings per share (EPS) is a company's [[net income|net-income]] divided across every outstanding share.",
          "It converts total company profit into a per-share number, standardized for comparison regardless of company size.",
          "The reason this matters to an individual shareholder specifically: you don't own 'the company's profit' directly, you own a slice of it proportional to your shares. EPS is that slice expressed in dollars — the actual unit of profit a single share of stock can be said to have earned."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "EPS is the direct input to the P/E ratio and many other valuation metrics.",
          "It's how 'profit' gets translated into something an individual shareholder's stake can be measured against.",
          "It's also the single number Wall Street reacts to most mechanically each quarter — a company can grow revenue and still see its stock fall if EPS comes in a cent below what analysts expected, and vice versa, since the market is pricing in a specific estimate ahead of time."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does EPS stand for?",
              "options": [
                "Earnings Percentage Score",
                "Earnings Per Share",
                "Equity Per Stock",
                "Estimated Profit Share"
              ],
              "correctIndex": 1
            },
            {
              "question": "What does EPS convert total company profit into?",
              "options": [
                "A per-share number",
                "A currency exchange rate",
                "A per-employee number",
                "A percentage of revenue"
              ],
              "correctIndex": 0
            },
            {
              "question": "Why does EPS matter to investors?",
              "options": [
                "It replaces the need for a balance sheet",
                "It sets the company's stock ticker symbol",
                "It determines the company's tax rate",
                "It's the direct input to the P/E ratio and other valuation metrics"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "EPS = (Net Income − [[Preferred Dividends|preferred-dividends]]) ÷ [[Weighted Average Shares Outstanding|weighted-average-shares]].",
          "Preferred dividends are subtracted first since that income isn't available to common shareholders.",
          "The share count uses a weighted average, not a single snapshot, because share counts change mid-year — a company that issued new shares or bought back stock partway through the period has a genuinely different average share count than either its opening or closing figure."
        ],
        "formula": {
          "terms": [
            { "symbol": "Net Income", "meaning": "Total profit for the period", "color": "purple" },
            { "symbol": "Pref. Div.", "meaning": "Preferred dividends owed", "color": "amber" }
          ],
          "operators": ["−"],
          "result": { "symbol": "EPS", "meaning": "÷ weighted avg. shares", "color": "purple" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "A company earns $50M in net income and has 10M shares outstanding.",
          "EPS = $50M ÷ 10M = $5.00 per share.",
          "This is 'basic' EPS — the simplest version, using the actual share count. A company also reports 'diluted' EPS, which uses [[diluted shares|diluted-shares]]: the share count if every stock option, convertible bond, and similar security were actually converted into shares. Diluted EPS is always equal to or lower than basic EPS, and it's the more conservative, analyst-preferred figure since it reflects the maximum plausible dilution to existing shareholders."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the formula for EPS?",
              "options": [
                "(Net Income − Preferred Dividends) ÷ Weighted Average Shares Outstanding",
                "Revenue ÷ Shares Outstanding",
                "Share Price ÷ Net Income",
                "Net Income × Shares Outstanding"
              ],
              "correctIndex": 0
            },
            {
              "question": "A company earns $50M net income with 10M shares outstanding. What's its EPS?",
              "options": [
                "$500",
                "$0.20",
                "$50.00",
                "$5.00"
              ],
              "correctIndex": 3,
              "explanation": "$50M ÷ 10M shares = $5.00 per share."
            },
            {
              "question": "What's the difference between trailing and forward EPS?",
              "options": [
                "Trailing uses the last 12 months of actual results; forward uses analyst estimates",
                "Forward EPS is calculated only for banks",
                "There is no real difference",
                "Trailing is always higher than forward"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Trailing vs. Forward EPS",
        "body": [
          "Trailing EPS uses the last 12 months of actual reported results.",
          "Forward EPS uses analyst estimates for the upcoming year — inherently more uncertain since it's a projection.",
          "There's a third way EPS can rise that has nothing to do with either: a [[share buyback|share-buyback]]. Dividing the exact same profit across fewer shares mechanically increases EPS — the illustration below holds net income perfectly flat and only shrinks the share count."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Same $100M net income, before vs. after a 20% buyback",
          "unit": "$",
          "bars": [
            { "label": "Before buyback (100M shares)", "value": 1.0 },
            { "label": "After buyback (80M shares)", "value": 1.25 }
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "Watch for EPS growth driven by share buybacks rather than real profit growth.",
          "If a company buys back stock, the same total profit gets divided across fewer shares, pushing EPS up even if the underlying business hasn't grown at all — a genuinely common pattern, not just a theoretical edge case, as the case study below shows.",
          "A second, subtler pitfall: companies frequently report their own 'adjusted' EPS figure alongside the official one, excluding whatever they consider one-off costs."
        ],
        "deepDive": {
          "title": "GAAP EPS vs. 'adjusted' EPS",
          "body": [
            "[[Non-GAAP earnings|non-gaap-earnings]] strip out items a company considers non-recurring — restructuring charges, stock-based compensation, impairments — to show what management calls its 'underlying' profitability.",
            "The catch is that the company itself chooses what to exclude, and some of these 'one-off' items (stock-based compensation especially) recur every single quarter at many firms, making the adjusted figure look more flattering than the audited GAAP number.",
            "Professional analysts routinely compare both figures side by side rather than taking the adjusted number at face value — a large, persistent gap between GAAP and non-GAAP EPS is itself a signal worth investigating."
          ]
        },
        "caseStudy": {
          "title": "IBM's decades-long buyback program",
          "body": [
            "Between 1995 and 2019, IBM spent roughly $201 billion repurchasing its own shares — averaging about $8 billion a year for 25 straight years — shrinking its share count from about 1.9 billion shares in 1997 to under 1 billion by the late 2010s, roughly halving it.",
            "For years, this reliably pushed EPS higher even in periods when IBM's underlying revenue was flat or shrinking as its older technology businesses matured and newer ones hadn't yet replaced that revenue.",
            "The strategy had a real limit: in the mid-2010s, then-CEO Ginni Rometty ultimately abandoned a multi-year 'roadmap' target (originally set by her predecessor) of reaching $20 in EPS by 2015, after it became clear that buybacks alone couldn't keep manufacturing earnings growth the underlying business wasn't producing.",
            "The takeaway isn't that buybacks are bad — returning cash to shareholders is a legitimate capital-allocation choice. It's that EPS growth built mainly on a shrinking share count, rather than a growing business, can mask exactly the kind of stagnation this slide is warning about."
          ],
          "source": "Discerning Readers, 'An Overview of IBM's Share Buyback Strategy & Cost' (buyback totals); The Motley Fool and IBTimes reporting on IBM's abandoned 2015 EPS 'Roadmap' target",
          "sourceUrl": "https://www.discerningreaders.com/ibm-twenty-first-century-share-buybacks.html"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What can artificially inflate EPS without real profit growth?",
              "options": [
                "Hiring more employees",
                "Splitting the stock",
                "Increasing the dividend",
                "Share buybacks reducing the share count"
              ],
              "correctIndex": 3
            },
            {
              "question": "If a company's total profit stays flat but it buys back 10% of its shares, what happens to EPS?",
              "options": [
                "EPS rises even though profit didn't grow",
                "EPS stays exactly the same",
                "EPS falls",
                "EPS becomes negative"
              ],
              "correctIndex": 0
            },
            {
              "question": "Why should investors be cautious about EPS growth driven purely by buybacks?",
              "options": [
                "It has no effect on EPS at all",
                "It can mask a business that isn't actually growing",
                "It always signals fraud",
                "Buybacks are illegal"
              ],
              "correctIndex": 1
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "ebitda",
    "title": "EBITDA",
    "descriptor": "Profitability, simplified",
    "toolHref": "/tools/ebitda",
    "toolLabel": "EBITDA Calculator",
    "slides": [
      {
        "type": "content",
        "title": "What Does EBITDA Stand For?",
        "body": [
          "Earnings Before Interest, Taxes, [[Depreciation|depreciation]], and Amortization.",
          "It aims to show how much cash-generating profit a company's core operations produce, before financing decisions and non-cash accounting charges.",
          "EBITDA exists because [[net income|net-income]] bundles together the underlying business's performance with decisions that have nothing to do with how well the business itself is run — how much debt it carries, what tax rate it happens to pay, and how its accountants schedule depreciation. EBITDA tries to isolate just the operating engine."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "EBITDA is especially useful for comparing companies with very different capital structures or asset bases.",
          "It strips out the effects of debt levels, tax jurisdictions, and depreciation schedules, leaving a more apples-to-apples operating comparison.",
          "It's the backbone metric of private equity and M&A — deals are routinely priced and discussed as a multiple of EBITDA (see EV/EBITDA), and lenders often size how much debt a company can safely take on as a multiple of its EBITDA too."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does EBITDA stand for?",
              "options": [
                "Earnings Before Interest, Taxes, Depreciation, and Amortization",
                "Earnings Before Income, Tax, Debt, and Assets",
                "Earnings Based on Investment, Tax, Depreciation, Assets",
                "Estimated Business Income, Taxes, Debt, Amortization"
              ],
              "correctIndex": 0
            },
            {
              "question": "What is EBITDA meant to approximate?",
              "options": [
                "A company's stock price",
                "A company's core operating profit",
                "A company's total market value",
                "A company's dividend payout"
              ],
              "correctIndex": 1
            },
            {
              "question": "Why is EBITDA useful when comparing companies?",
              "options": [
                "It only applies to companies with no debt",
                "It replaces the need for revenue figures",
                "It shows the exact stock price target",
                "It strips out differences in financing and accounting choices, like debt and depreciation"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "EBITDA = Net Income + Interest + Taxes + Depreciation + Amortization.",
          "Each item is added back to net income to arrive at a pre-financing, pre-accounting-charge profit figure — visualized below as a build-up from the bottom line back up to EBITDA, one add-back at a time."
        ],
        "formula": {
          "terms": [
            { "symbol": "Net Income", "meaning": "Bottom-line profit", "color": "orange" },
            { "symbol": "Interest", "meaning": "Debt financing cost", "color": "blue" },
            { "symbol": "Taxes", "meaning": "Income taxes paid", "color": "purple" },
            { "symbol": "D&A", "meaning": "Depreciation & amortization", "color": "amber" }
          ],
          "operators": ["+", "+", "+"],
          "result": { "symbol": "EBITDA", "meaning": "Core operating profit", "color": "orange" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Net income of $10M, plus interest of $2M, plus taxes of $3M, plus depreciation & amortization of $5M.",
          "EBITDA = $10M + $2M + $3M + $5M = $20M.",
          "Note this is $10M higher than net income alone — the further a company is from that $10M net income figure once you add everything back, the more its debt load, tax situation, or depreciation schedule (rather than its core operations) is shaping the headline profit number."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What's the formula for EBITDA?",
              "options": [
                "Revenue − Cost of Goods Sold",
                "Net Income ÷ Revenue",
                "Market Cap + Debt − Cash",
                "Net Income + Interest + Taxes + Depreciation + Amortization"
              ],
              "correctIndex": 3
            },
            {
              "question": "Net income is $10M, interest $2M, taxes $3M, and D&A $5M. What's EBITDA?",
              "options": [
                "$5M",
                "$20M",
                "$10M",
                "$15M"
              ],
              "correctIndex": 1,
              "explanation": "10 + 2 + 3 + 5 = 20M."
            },
            {
              "question": "Two companies have identical EBITDA, but one owns its factories while the other leases them. What does EBITDA do to this difference?",
              "options": [
                "It makes the numbers impossible to compare",
                "It largely evens out the comparison, since depreciation/financing differences are stripped out",
                "It doubles the leasing company's number",
                "It has no relationship to this at all"
              ],
              "correctIndex": 1
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Comparing Companies",
        "body": [
          "A company that owns its factories outright and one that leases equivalent equipment can look very different on net income — the owner carries real depreciation and likely real debt interest; the lessor carries neither on its own books in the same way.",
          "On EBITDA, they look much more similar, since the debt and depreciation differences are stripped out — illustrated below with two otherwise-comparable companies."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Two otherwise-similar companies: Net Income vs. EBITDA",
          "unit": "M",
          "bars": [
            { "label": "Company A (owns factories) — Net Income", "value": 8 },
            { "label": "Company A — EBITDA", "value": 20 },
            { "label": "Company B (leases) — Net Income", "value": 17 },
            { "label": "Company B — EBITDA", "value": 21 }
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "EBITDA is not the same as cash flow — interest on debt still has to be paid, and depreciating equipment eventually needs to be replaced with real cash.",
          "It's a useful lens for comparing operating performance, not a substitute for looking at actual cash flow and debt levels.",
          "Because EBITDA is so central to deal pricing and loan covenants, it's also the metric companies are most tempted to inflate with their own 'adjustments' — the case study below is one of the most famous examples of EBITDA-multiple deal-making in history."
        ],
        "deepDive": {
          "title": "Watch for 'adjusted EBITDA'",
          "body": [
            "Companies — especially ones being sold, or carrying loan covenants tied to an EBITDA threshold — often report 'adjusted EBITDA,' adding back further items beyond the standard four: one-time legal costs, stock-based compensation, 'pro forma' cost savings that haven't happened yet, and more.",
            "Some of these add-backs are reasonable; others exist mainly to make a leverage ratio or valuation look better. A useful habit is checking how much 'adjusted EBITDA' differs from plain EBITDA, and reading what, specifically, is being added back."
          ]
        },
        "caseStudy": {
          "title": "The RJR Nabisco leveraged buyout (1988-89)",
          "body": [
            "One of the most famous EBITDA-driven deals in history: in 1988, private equity firm KKR won a bidding war for food and tobacco conglomerate RJR Nabisco, ultimately paying about $25 billion — roughly $109 per share — to take the company private.",
            "RJR Nabisco's EBITDA at the time was roughly $3.1 billion, meaning KKR's winning bid valued the company at approximately 7.5 to 8 times EBITDA — exactly the kind of multiple this course's own EV/EBITDA companion topic is built around, and the standard language leveraged buyouts are still priced in today.",
            "The deal was financed largely with borrowed money (over $20 billion in high-yield debt) precisely BECAUSE lenders were willing to size that debt as a multiple of RJR Nabisco's EBITDA — a direct, real-world illustration of EBITDA's role as the currency of leveraged finance, not just an academic ratio.",
            "The buyout became famous partly because of its sheer size and drama (chronicled in the book and film 'Barbarians at the Gate'), and partly as a cautionary tale — the debt load proved heavy, and the deal is widely regarded as having underperformed the assumptions behind KKR's bid."
          ],
          "source": "ESCP Finance Society, 'KKR's first leveraged buyout battle ($25bn): The fall of RJR Nabisco'",
          "sourceUrl": "https://escpfinancesociety.wordpress.com/2019/01/22/all-time-classic-kkrs-first-leveraged-buyout-battle-25bn-the-fall-of-rjr-nabisco-yes-barbarians-are-really-at-the-gate/"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "Is EBITDA the same as cash flow?",
              "options": [
                "Yes, but only for banks",
                "No — interest still has to be paid and equipment still needs cash to replace",
                "No, EBITDA is always higher than revenue",
                "Yes, they are identical"
              ],
              "correctIndex": 1
            },
            {
              "question": "What's a common criticism of EBITDA?",
              "options": [
                "It ignores real costs like interest payments and capital expenditures",
                "It only applies to government agencies",
                "It's too complicated to calculate",
                "It can't be compared across industries at all"
              ],
              "correctIndex": 0
            },
            {
              "question": "EBITDA is best used as...",
              "options": [
                "A lens for comparing operating performance, not a substitute for cash flow analysis",
                "The single most important number in investing",
                "A tax filing requirement",
                "A replacement for the balance sheet"
              ],
              "correctIndex": 0
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "ev-ebitda",
    "title": "EV/EBITDA",
    "descriptor": "Value vs. earnings power",
    "toolHref": "/tools/ev-ebitda",
    "toolLabel": "EV/EBITDA Calculator",
    "slides": [
      {
        "type": "content",
        "title": "What Is EV/EBITDA?",
        "body": [
          "Enterprise value divided by [[EBITDA|ebitda]] — a valuation multiple that, unlike P/E, accounts for the whole capital structure.",
          "It answers: how much is the market paying for this company's operating earnings, once debt and cash are factored in?",
          "Enterprise value represents what it would actually cost to buy the whole company outright — the equity (market cap) plus the debt an acquirer would assume, minus the cash sitting on the balance sheet the acquirer would immediately get back. That's a fundamentally different, more complete question than P/E's 'what does the equity alone cost.'"
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "It lets you compare companies with different debt and cash levels on a more apples-to-apples basis than P/E allows.",
          "It's a favorite metric in private equity and M&A analysis for exactly that reason — it's the multiple actually used to price real company sales, not just a classroom ratio.",
          "Because it uses EBITDA rather than net income in the denominator, it also sidesteps differences in tax rate and depreciation policy the same way EBITDA itself does — see this course's companion EBITDA topic for that half of the picture."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does EV/EBITDA measure?",
              "options": [
                "Market cap relative to P/E",
                "Stock price relative to dividends",
                "Enterprise value relative to a company's EBITDA",
                "Revenue relative to employees"
              ],
              "correctIndex": 2
            },
            {
              "question": "How is EV/EBITDA different from the P/E ratio?",
              "options": [
                "It accounts for the whole capital structure (debt and cash), not just equity value",
                "It's calculated the exact same way as P/E",
                "It's only used for currencies",
                "It ignores earnings completely"
              ],
              "correctIndex": 0
            },
            {
              "question": "Who commonly favors EV/EBITDA as a valuation tool?",
              "options": [
                "Tax auditors",
                "Currency traders",
                "Home buyers",
                "Private equity and M&A analysts"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "[[Enterprise Value|enterprise-value]] = Market Cap + Total Debt − Cash.",
          "EV/EBITDA = Enterprise Value ÷ EBITDA."
        ],
        "formula": {
          "terms": [
            { "symbol": "Market Cap", "meaning": "Equity value", "color": "blue" },
            { "symbol": "Debt", "meaning": "Total debt assumed", "color": "amber" },
            { "symbol": "Cash", "meaning": "Cash on hand", "color": "teal" }
          ],
          "operators": ["+", "−"],
          "result": { "symbol": "EV", "meaning": "Enterprise value", "color": "blue" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Market cap of $800M, plus debt of $300M, minus cash of $100M → Enterprise Value of $1,000M.",
          "With EBITDA of $100M, EV/EBITDA = $1,000M ÷ $100M = 10x.",
          "Notice the company's P/E could look completely different from its EV/EBITDA if it carried unusually high debt or cash — that gap is exactly the information EV/EBITDA adds on top of a plain P/E."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the formula for Enterprise Value?",
              "options": [
                "Market Cap + Total Debt − Cash",
                "EPS × Shares Outstanding",
                "Market Cap − Total Debt + Cash",
                "Revenue − Net Income"
              ],
              "correctIndex": 0
            },
            {
              "question": "A company has a market cap of $800M, debt of $300M, and cash of $100M. What's its EV?",
              "options": [
                "$1,200M",
                "$400M",
                "$600M",
                "$1,000M"
              ],
              "correctIndex": 3,
              "explanation": "800 + 300 − 100 = 1,000M."
            },
            {
              "question": "That same company has EBITDA of $100M. What's its EV/EBITDA?",
              "options": [
                "20x",
                "5x",
                "10x",
                "1x"
              ],
              "correctIndex": 2,
              "explanation": "$1,000M ÷ $100M = 10x."
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Number",
        "body": [
          "A lower multiple can suggest a company is cheaper relative to its operating earnings; a higher multiple suggests a premium.",
          "As always, it's most meaningful compared against similar companies in the same industry, not in isolation — the illustrative ranges below are a rough guide to how much this varies by sector."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Illustrative EV/EBITDA ranges by sector (typical, not any specific deal)",
          "unit": "x",
          "bars": [
            { "label": "Utilities", "value": 9 },
            { "label": "Industrials", "value": 11 },
            { "label": "Retail", "value": 10 },
            { "label": "Software/Tech", "value": 16 }
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "EV/EBITDA still relies on EBITDA's own limitations — it ignores real cash costs like capital expenditures and interest.",
          "A low multiple can also reflect real risk the market has already priced in, not just a bargain. The case study below shows how this multiple actually gets used — and benchmarked against a sector average — in a real, closely-watched acquisition."
        ],
        "deepDive": {
          "title": "How dealmakers actually use this multiple",
          "body": [
            "In M&A, bankers build a 'comparable companies' analysis: a table of similar public companies' EV/EBITDA multiples, plus a 'precedent transactions' analysis of what similar companies actually sold for, to bracket a reasonable price range for a deal — rather than relying on one company's multiple in isolation.",
            "An acquirer will also often pay a control premium above where a company already trades publicly, since buying 100% of a company and its decision-making rights is worth more than trading a minority stake of shares on an exchange — one reason acquisition EV/EBITDA multiples often run above the sector's typical public-market trading range."
          ]
        },
        "caseStudy": {
          "title": "Amazon's acquisition of Whole Foods (2017)",
          "body": [
            "In 2017, Amazon acquired grocery chain Whole Foods Market for about $13.7 billion in cash, paying $42 per share — a 27% premium to Whole Foods' prior closing price.",
            "That price implied an EV/EBITDA multiple of roughly 10.5 times — just slightly above the retail sector's own average take-out multiple of about 9.9 times over the preceding 11 years, according to analysis at the time.",
            "In other words, Amazon paid a real premium to get the deal done (as most acquirers do), but not a wildly disconnected one relative to what similar retail companies had historically sold for — exactly the kind of sector-benchmarked reasoning this course's 'Reading the Number' slide describes.",
            "For Amazon strategically, the deal was less about Whole Foods' standalone profitability and more about instant physical retail infrastructure — a reminder that even a well-grounded multiple doesn't capture every reason a buyer might pay a given price."
          ],
          "source": "Bocconi Students Investment Club (BSIC), 'Amazon Completes Acquisition of Whole Foods Market for $13.7bn'",
          "sourceUrl": "https://bsic.it/amazon-completes-acquisition-whole-foods-market-13-7bn/"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "A lower EV/EBITDA multiple generally suggests...",
              "options": [
                "The company has no debt at all",
                "The company is guaranteed to go up in price",
                "The company doesn't pay taxes",
                "The company may be cheaper relative to its operating earnings"
              ],
              "correctIndex": 3
            },
            {
              "question": "What limitation does EV/EBITDA share with EBITDA itself?",
              "options": [
                "It requires a stock split first",
                "It can't be calculated for any public company",
                "It still ignores real cash costs like capital expenditures and interest",
                "It only works for very small companies"
              ],
              "correctIndex": 2
            },
            {
              "question": "Why should a low EV/EBITDA multiple not automatically be read as a 'bargain'?",
              "options": [
                "Low multiples are always calculation errors",
                "It can also reflect real risk the market has already priced in",
                "It always means fraud is involved",
                "It means the company has stopped operating"
              ],
              "correctIndex": 1
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "dcf",
    "title": "DCF",
    "descriptor": "Valuing future cash",
    "toolHref": "/tools/dcf",
    "toolLabel": "DCF Calculator",
    "slides": [
      {
        "type": "content",
        "title": "What Is a DCF?",
        "body": [
          "A discounted cash flow (DCF) analysis estimates what a company is worth today by projecting its future [[free cash flow|free-cash-flow]].",
          "Those future cash flows are then 'discounted' back to a present value.",
          "DCF sits in a different camp from ratio-based tools like P/E or EV/EBITDA. A [[valuation multiple|valuation-multiple]] prices a company relative to other companies; a DCF prices it from first principles — its own projected cash generation — arriving at what analysts call [[intrinsic value|intrinsic-value]], independent of whatever the market happens to be paying for similar businesses right now."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "A dollar received five years from now is worth less than a dollar today, because of inflation and the opportunity cost of not having that money now.",
          "DCF is the formal way of pricing that difference and building a valuation from first principles, rather than from comparisons to other companies.",
          "The [[discount rate|discount-rate]] that does this pricing isn't one abstract number — for a company, it's typically built from three ingredients: a risk-free baseline (like a long-term government bond yield), an [[equity risk premium|equity-risk-premium]] for the extra return stock investors demand over that baseline, and an adjustment for the specific company's own risk relative to the market."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does DCF stand for?",
              "options": [
                "Delayed Cash Flow",
                "Debt Coverage Factor",
                "Direct Company Financing",
                "Discounted Cash Flow"
              ],
              "correctIndex": 3
            },
            {
              "question": "What is a DCF analysis trying to estimate?",
              "options": [
                "The number of shares a company should issue",
                "The company's tax bill for the year",
                "What a company is worth today, based on projected future cash flows",
                "The company's current stock price directly from the exchange"
              ],
              "correctIndex": 2
            },
            {
              "question": "Why is a dollar received in 5 years worth less than a dollar today in this model?",
              "options": [
                "Because of inflation and the opportunity cost of not having the money now",
                "Because currency always loses exactly half its value every 5 years",
                "Because companies are required to discount by law",
                "It isn't — a future dollar is always worth the same"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula (Simplified)",
        "body": [
          "Present Value = Future Cash Flow ÷ (1 + discount rate) ^ years.",
          "This is repeated for each projected year, then a [[terminal value|terminal-value]] is added for everything beyond the explicit projection window — in most real-world DCFs, this terminal value ends up being the single largest piece of the total valuation, often well over half of it."
        ],
        "formula": {
          "terms": [
            { "symbol": "FCF", "meaning": "Future free cash flow", "color": "pink" },
            { "symbol": "(1+r)ⁿ", "meaning": "Discount rate over n years", "color": "amber" }
          ],
          "operators": ["÷"],
          "result": { "symbol": "PV", "meaning": "Present value", "color": "pink" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Start with $1M in free cash flow, growing 10% per year for 5 years, discounted at 9%.",
          "Each year's projected cash flow is shrunk back to today's dollars using the formula above, then all the present values are summed — visualized below: the gray bars are each year's raw projected cash flow, and the blue bars are what that same cash flow is actually worth today once discounted."
        ],
        "visual": {
          "type": "cash-flow",
          "title": "Projected free cash flow vs. present value",
          "rows": [
            { "year": 1, "projectedFcf": 1100000, "presentValue": 1009000 },
            { "year": 2, "projectedFcf": 1210000, "presentValue": 1018000 },
            { "year": 3, "projectedFcf": 1331000, "presentValue": 1028000 },
            { "year": 4, "projectedFcf": 1464000, "presentValue": 1037000 },
            { "year": 5, "projectedFcf": 1611000, "presentValue": 1047000 }
          ]
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does the DCF formula shrink each future cash flow by?",
              "options": [
                "The company's stock price",
                "The company's market cap",
                "The number of employees",
                "(1 + discount rate) raised to the power of the number of years"
              ],
              "correctIndex": 3
            },
            {
              "question": "What is a 'terminal value' in a DCF?",
              "options": [
                "The value of the company on its last day of business",
                "A tax penalty",
                "The value of unsold inventory only",
                "An estimate of value for everything beyond the explicit projection period"
              ],
              "correctIndex": 3
            },
            {
              "question": "Which of these is NOT one of the key inputs to a basic DCF?",
              "options": [
                "The company's stock ticker symbol",
                "The growth rate",
                "The terminal growth rate",
                "The discount rate"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Key Inputs",
        "body": [
          "Growth rate, discount rate, projection period, and terminal growth rate are the levers that drive a DCF's output.",
          "Small changes in any of these can swing the resulting valuation significantly.",
          "Professionals rarely trust a single output number — they build a range around it instead, explored in the deep dive below."
        ],
        "deepDive": {
          "title": "How professionals actually build a DCF",
          "body": [
            "The discount rate used for a whole company is almost always [[WACC|wacc]] — a blend of the [[cost of capital|cost-of-capital]] for its equity and its debt, weighted by how much of each the company actually uses to fund itself, rather than a single guessed number.",
            "For terminal value, there are two standard methods: the [[Gordon Growth Model|gordon-growth-model]] (assume cash flows grow at a modest, constant rate — often close to long-run GDP growth — forever), or the exit-multiple method (apply a reasonable valuation multiple, like EV/EBITDA, to the final projected year, essentially assuming the company gets 'sold' at that multiple). Professionals often calculate both and sanity-check one against the other.",
            "Because every input is an estimate, analysts commonly build a 'football field' — a sensitivity table or chart showing the resulting valuation across a grid of different discount-rate and growth-rate assumptions, rather than presenting one single number as if it were precise. The DCF calculator elsewhere in this app lets you do exactly this by hand: change the growth or discount rate and watch the output move."
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "DCF is often described as 'precisely wrong' — it produces an exact-looking number from inputs that are ultimately estimates.",
          "It's most useful for reasoning about what has to be true for a given price to make sense, not as a single definitive answer — the case study below is a well-documented real example of exactly that kind of reasoning, applied to a real, closely-watched IPO."
        ],
        "caseStudy": {
          "title": "Valuing Uber ahead of its 2019 IPO",
          "body": [
            "Ahead of Uber's May 2019 IPO, NYU finance professor Aswath Damodaran — a widely-followed valuation practitioner often nicknamed the 'Dean of Valuation' — published his own DCF-based valuation of the company, working from Uber's projected total addressable market, ride volume, and long-run margins.",
            "His estimate put Uber's per-share value at roughly $31–33, implying a company value well under half of the roughly $100 billion some bankers were reportedly floating ahead of the offering. Damodaran was explicit about why: Uber was still losing money at scale, and he judged the path to sustainable profitability far less certain than the higher price implied.",
            "Uber ultimately priced its IPO at $45 per share in May 2019 — above Damodaran's estimate, though well below the most bullish pre-IPO chatter, and the stock traded below its IPO price for a considerable stretch afterward.",
            "This is a genuine, publicly-documented illustration of the 'Limitations' point above in action: Damodaran's DCF didn't claim to predict Uber's exact future stock price. It laid out, transparently, what growth and margin assumptions would have to hold true to justify a given price — precisely the reasoning exercise a DCF is actually good for."
          ],
          "source": "Aswath Damodaran, 'Uber's Coming out Party: Personal Mobility Pioneer or Car Service on Steroids?' (Musings on Markets blog, April 2019); contemporaneous CNBC and Bloomberg coverage of his valuation",
          "sourceUrl": "https://aswathdamodaran.blogspot.com/2019/04/ubers-coming-out-party-personal.html"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "Why is DCF sometimes called 'precisely wrong'?",
              "options": [
                "It never produces a number at all",
                "It produces an exact-looking number built from inputs that are ultimately estimates",
                "It's only accurate for bankrupt companies",
                "It uses random numbers instead of real data"
              ],
              "correctIndex": 1
            },
            {
              "question": "What happens to a DCF valuation if the discount rate assumption changes meaningfully?",
              "options": [
                "The stock automatically splits",
                "Nothing changes at all",
                "The company's actual cash flow changes",
                "The resulting valuation can swing significantly"
              ],
              "correctIndex": 3
            },
            {
              "question": "What is DCF most useful for, despite its sensitivity to assumptions?",
              "options": [
                "Reasoning about what has to be true for a given price to make sense",
                "Calculating a company's tax refund",
                "Predicting tomorrow's exact stock price",
                "Replacing the need for any other analysis"
              ],
              "correctIndex": 0
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "market-cap",
    "title": "Market Cap",
    "descriptor": "Company's price tag",
    "slides": [
      {
        "type": "content",
        "title": "What Is Market Cap?",
        "body": [
          "Market capitalization is a company's current share price multiplied by its total number of outstanding shares.",
          "It represents the total value the market currently places on the company's equity.",
          "It exists because share price alone tells you almost nothing about size — a $500 stock with 10 million shares is a smaller company than a $20 stock with a billion shares. Multiplying the two together is what actually measures 'how big is this company, in dollar terms, right now.'"
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "It's the quickest way to gauge a company's overall size.",
          "It drives how companies get grouped and compared — small-cap, mid-cap, large-cap, and so on.",
          "It also drives real capital flows: index funds tracking a market-cap-weighted index (like the S&P 500) automatically own more of the largest companies and less of the smallest, simply because of how the index itself is constructed."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is market capitalization?",
              "options": [
                "The number of employees times average salary",
                "Share price multiplied by total shares outstanding",
                "The company's total debt",
                "Total company revenue for the year"
              ],
              "correctIndex": 1
            },
            {
              "question": "What does market cap represent?",
              "options": [
                "The market's current valuation of a company's equity",
                "The company's total cash reserves",
                "The company's tax liability",
                "The company's total number of customers"
              ],
              "correctIndex": 0
            },
            {
              "question": "Is market cap the same as a company's total business value including debt?",
              "options": [
                "No — that's what enterprise value measures instead",
                "Yes, they're identical",
                "Yes, but only for banks",
                "No, market cap is always higher than enterprise value"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "Market Cap = Share Price × Shares Outstanding."
        ],
        "formula": {
          "terms": [
            { "symbol": "Price", "meaning": "Current share price", "color": "blue" },
            { "symbol": "Shares", "meaning": "Total shares outstanding", "color": "amber" }
          ],
          "operators": ["×"],
          "result": { "symbol": "Market Cap", "meaning": "Total equity value", "color": "blue" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "A company trades at $50 per share and has 200M shares outstanding.",
          "Market Cap = $50 × 200M = $10 billion.",
          "Because share price moves constantly during trading hours, market cap for a public company is really a live, ever-changing number — the $10 billion figure here is only true at the instant the share price is $50."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the formula for market cap?",
              "options": [
                "Share Price × Shares Outstanding",
                "Share Price ÷ EPS",
                "Net Income × P/E Ratio",
                "Revenue ÷ Shares Outstanding"
              ],
              "correctIndex": 0
            },
            {
              "question": "A company trades at $50/share with 200M shares outstanding. What's its market cap?",
              "options": [
                "$10 billion",
                "$2.5 billion",
                "$200 million",
                "$50 billion"
              ],
              "correctIndex": 0,
              "explanation": "$50 × 200M = $10 billion."
            },
            {
              "question": "Roughly, which size category does a company worth tens of billions to trillions of dollars typically fall into?",
              "options": [
                "Nano-cap",
                "Large-cap or mega-cap",
                "Micro-cap",
                "Small-cap"
              ],
              "correctIndex": 1
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Size Categories",
        "body": [
          "Roughly: small-cap (under a few billion), mid-cap (a few billion to ~$10-20B), and large-cap or mega-cap (tens of billions to trillions).",
          "These bands are rough, shift over time, and vary by source — but they're a useful shorthand for a company's overall size and typical risk profile.",
          "Size correlates loosely with risk: small-caps tend to be more volatile and less liquid but offer more room to grow; mega-caps tend to be more stable but structurally can't multiply in value as easily — doubling a $3 trillion company requires creating another $3 trillion of value, a very different task than doubling a $300 million one."
        ]
      },
      {
        "type": "content",
        "title": "What It Doesn't Tell You",
        "body": [
          "Market cap ignores debt entirely — that's what [[enterprise value|enterprise-value]] is for.",
          "It also says nothing about revenue, profit, or book value — just what the market currently pays for the equity.",
          "Two companies can have identical market caps and be completely different investments — one debt-free with a struggling business, the other loaded with debt but growing fast. Market cap alone can't distinguish them; enterprise value and the other metrics in this course start to."
        ],
        "deepDive": {
          "title": "Market cap vs. float",
          "body": [
            "Market cap uses ALL outstanding shares, including ones held by insiders, founders, or the company itself that rarely trade. 'Float' — the shares actually available for public trading — can be meaningfully smaller.",
            "A company with a large market cap but a small float can see outsized price swings on relatively modest trading volume, since there are fewer actual shares changing hands to absorb buying or selling pressure. Index providers often use float-adjusted market cap, not total market cap, for exactly this reason."
          ]
        },
        "caseStudy": {
          "title": "Apple's first $1 trillion close (2018)",
          "body": [
            "On August 2, 2018, Apple became the first publicly traded U.S. company to reach a $1 trillion market capitalization — its shares touched $207.05 intraday, the exact price needed to cross the threshold, and closed the day at $207.39, valuing the company at just over $1 trillion.",
            "The milestone came on the heels of a strong quarterly earnings report and reflected decades of compounding: Apple had traded as a comparatively small company for years before iPhone-era growth propelled it into a category no company had occupied before.",
            "It wasn't the end of the story — Apple reached $2 trillion barely two years later, in August 2020, illustrating how, for a company still growing profits briskly, even a market cap already in the trillions doesn't preclude much further growth.",
            "The milestone is a clean, concrete illustration of exactly what this course's formula measures: a live, constantly recalculated multiplication of share price by share count, and nothing more or less than that."
          ],
          "source": "CNBC, 'Apple hangs onto its historic $1 trillion market cap' (August 2, 2018)",
          "sourceUrl": "https://www.cnbc.com/2018/08/02/apple-hits-1-trillion-in-market-value.html"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does market cap NOT tell you about a company?",
              "options": [
                "Its current share price",
                "Its total shares outstanding",
                "Its revenue, profit, or book value",
                "Its size relative to other companies"
              ],
              "correctIndex": 2
            },
            {
              "question": "Why does market cap change constantly even though shares outstanding usually don't?",
              "options": [
                "Because market cap is fixed once a year",
                "Because it only updates during earnings season",
                "Because the share price itself moves throughout the trading day",
                "Because companies re-issue all their shares daily"
              ],
              "correctIndex": 2
            },
            {
              "question": "What could cause a company's shares outstanding to actually change?",
              "options": [
                "A change in the CEO",
                "Issuing new shares or buying back existing ones",
                "A change in the company's ticker symbol",
                "The stock market closing for a holiday"
              ],
              "correctIndex": 1
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "dividend-yield",
    "title": "Dividend Yield",
    "descriptor": "Cash paid to you",
    "slides": [
      {
        "type": "content",
        "title": "What Is Dividend Yield?",
        "body": [
          "Dividend yield is a company's annual dividend per share divided by its current share price, expressed as a percentage.",
          "It's the cash return a stock pays out relative to what you'd pay for it today.",
          "It exists to answer a very practical question for an income-focused investor: 'if I buy this stock today and nothing changes, roughly what percentage of my money comes back to me each year in cash, separate from whatever the share price itself does?'"
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "It tells you what percentage of your investment you'd receive back each year in cash dividends, at the current price and payout rate.",
          "It's a key metric for income-focused investors.",
          "Dividend yield is also the entry point to a broader strategy: automatically reinvesting those payouts to buy more shares over time, an approach known as a [[DRIP|drip]] (dividend reinvestment plan) — modeled out in this app's own DRIP calculator."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does dividend yield measure?",
              "options": [
                "The company's debt-to-equity ratio",
                "The company's total profit margin",
                "The cash return a stock pays out, as a percentage of its price",
                "The number of shares outstanding"
              ],
              "correctIndex": 2
            },
            {
              "question": "Who is dividend yield especially important to?",
              "options": [
                "Income-focused investors",
                "Companies with no shareholders",
                "Bond issuers only",
                "Day traders only"
              ],
              "correctIndex": 0
            },
            {
              "question": "What does dividend yield tell you at the current price and payout rate?",
              "options": [
                "The company's employee count",
                "The exact future stock price",
                "The company's total assets",
                "What percentage of your investment comes back as cash dividends each year"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "The Formula",
        "body": [
          "Dividend Yield = Annual Dividend Per Share ÷ Share Price × 100."
        ],
        "formula": {
          "terms": [
            { "symbol": "Div/Share", "meaning": "Annual dividend per share", "color": "emerald" },
            { "symbol": "Price", "meaning": "Current share price", "color": "blue" }
          ],
          "operators": ["÷"],
          "result": { "symbol": "Yield", "meaning": "× 100, as a percent", "color": "emerald" }
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "A stock pays $2.00 per year in dividends and trades at $50 per share.",
          "Dividend Yield = $2.00 ÷ $50 × 100 = 4%.",
          "If that same $2.00 dividend stays exactly the same but the stock falls to $25, the yield doubles to 8% — not because the company got more generous, but purely because the price dropped. That mechanical relationship is the subject of the next slide."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is the formula for dividend yield?",
              "options": [
                "EPS × Dividend Payout Ratio",
                "Share Price ÷ Annual Dividend Per Share",
                "Annual Dividend Per Share ÷ Share Price × 100",
                "Net Income ÷ Dividends Paid"
              ],
              "correctIndex": 2
            },
            {
              "question": "A stock pays $2.00/year in dividends and trades at $50/share. What's its yield?",
              "options": [
                "4%",
                "25%",
                "10%",
                "2%"
              ],
              "correctIndex": 0,
              "explanation": "$2.00 ÷ $50 × 100 = 4%."
            },
            {
              "question": "If a stock's price falls but its dividend stays the same, what happens to its yield?",
              "options": [
                "The yield falls",
                "The yield becomes negative",
                "The yield stays exactly the same",
                "The yield rises"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Number — Watch the Direction",
        "body": [
          "Yield moves with price even when the dividend itself doesn't change — a falling stock price pushes yield up.",
          "A sudden double-digit yield is often a warning sign the market expects a cut, not a bargain — the stock has fallen because investors doubt the current payout is sustainable, and the yield looks 'high' only until the dividend actually gets cut to match.",
          "This is sometimes called a 'dividend yield trap': the number looks most attractive right before it stops being true."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Same $2.00 dividend, before and after a price decline",
          "unit": "%",
          "bars": [
            { "label": "Share price $50", "value": 4 },
            { "label": "Share price $25 (after a decline)", "value": 8, "highlight": true }
          ]
        }
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "Not every company pays a dividend — many growth companies reinvest everything instead, which isn't better or worse, just a different strategy.",
          "Always check whether the payout is sustainable relative to earnings before trusting the number — the case study below is one of the most-watched dividend cuts of the past decade."
        ],
        "deepDive": {
          "title": "The payout ratio: sustainability at a glance",
          "body": [
            "The [[payout ratio|payout-ratio]] (dividends paid ÷ net income, or ÷ free cash flow) shows how much of a company's profit is actually going out the door as dividends. A payout ratio comfortably under 100% suggests room to keep paying (and even raising) the dividend; one persistently above 100% means the company is paying out more than it earns, which usually isn't sustainable indefinitely.",
            "Professionals check payout ratio specifically because a high yield with a low, sustainable payout ratio is a very different situation from a high yield with a payout ratio already near or above 100%."
          ]
        },
        "caseStudy": {
          "title": "General Electric's 2017-2018 dividend cuts",
          "body": [
            "In November 2017, under then-new CEO John Flannery, General Electric cut its quarterly dividend in half — from 24 cents to 12 cents per share — after a strategic review concluded the payout no longer matched the underlying business's cash generation.",
            "The cut wasn't enough. Less than a year later, incoming CEO Larry Culp slashed the dividend again, this time to just 1 cent per share starting in 2019 — GE's third dividend cut in its 125-year history — as the company absorbed a $22 billion impairment charge and roughly $30 billion in losses over four quarters in its power business.",
            "GE stock fell nearly 50% over the course of 2018 as this played out — exactly the pattern this course warns about: a dividend that looked generous became a signal of distress once the underlying earnings could no longer support it.",
            "The lesson isn't that high yields are always dangerous — plenty of high-yield stocks are perfectly sustainable. It's that yield alone, without checking the payout ratio and earnings trend behind it, can't tell the difference between the two."
          ],
          "source": "Forbes, 'General Electric's Dividend Runs Out Of Power' (October 30, 2018)",
          "sourceUrl": "https://www.forbes.com/sites/antoinegara/2018/10/30/general-electrics-dividend-runs-out-of-power/"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What might a sudden, unusually high double-digit dividend yield actually signal?",
              "options": [
                "A guaranteed bargain with no risk",
                "The company has eliminated all debt",
                "A stock split is imminent",
                "The market expects the dividend to be cut"
              ],
              "correctIndex": 3
            },
            {
              "question": "Do all companies pay dividends?",
              "options": [
                "Yes, every public company must pay one",
                "No — many growth-focused companies reinvest all profit back into the business instead",
                "Only companies outside the US pay dividends",
                "Only companies with negative earnings pay dividends"
              ],
              "correctIndex": 1
            },
            {
              "question": "What should you check before trusting a dividend yield number?",
              "options": [
                "Whether the payout is sustainable relative to the company's earnings",
                "The company's founding year",
                "The company's logo color",
                "The company's stock ticker length"
              ],
              "correctIndex": 0
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "beta",
    "title": "Beta",
    "descriptor": "Measuring volatility",
    "slides": [
      {
        "type": "content",
        "title": "What Is Beta?",
        "body": [
          "Beta measures how volatile a stock is relative to the broader market (usually a benchmark index like the S&P 500).",
          "The market itself is assigned a beta of 1.0.",
          "It exists because 'this stock is risky' is too vague to build a portfolio around. Beta gives that intuition a number — specifically, how much of the STOCK's price movement has historically tracked the market's own ups and downs, and by how much more or less."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "Beta is a quick gauge of a stock's relative risk and volatility.",
          "It's useful for building a portfolio with a deliberate overall risk level.",
          "Professional portfolio managers use beta to manage a fund's overall market exposure — deliberately blending high- and low-beta names to hit a target risk level, or 'hedging' by shorting a high-beta index against a long portfolio to reduce overall market sensitivity."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does beta measure?",
              "options": [
                "A company's dividend payout ratio",
                "A company's number of employees",
                "How volatile a stock is relative to the overall market",
                "A company's total revenue"
              ],
              "correctIndex": 2
            },
            {
              "question": "What beta value is the overall market benchmark assigned?",
              "options": [
                "-1",
                "100",
                "0",
                "1.0"
              ],
              "correctIndex": 3
            },
            {
              "question": "Why do investors use beta?",
              "options": [
                "To set the company's stock ticker symbol",
                "As a quick gauge of a stock's relative risk or volatility",
                "To calculate a company's tax rate",
                "To determine a company's headquarters location"
              ],
              "correctIndex": 1
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Number",
        "body": [
          "A beta of 1.5 has historically tended to move about 50% more than the market, in either direction.",
          "A beta of 0.5 suggests moves about half as large as the market's — the chart below shows a real, current example of just how wide this spread can get between two well-known stocks."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "Beta: a high-beta name vs. a low-beta defensive name (recent 5-year beta)",
          "unit": "",
          "bars": [
            { "label": "Tesla (high-beta)", "value": 1.8, "highlight": true },
            { "label": "S&P 500 (the market)", "value": 1.0 },
            { "label": "Procter & Gamble (low-beta)", "value": 0.38 }
          ]
        }
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "If the market rises 10% and a stock has a beta of 1.5, it has historically tended to rise about 15%.",
          "The same stock would tend to fall about 15% if the market fell 10%.",
          "This is a historical tendency, not a physical law — in any single period, a stock can (and often does) move quite differently than its beta alone would suggest."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "A stock has a beta of 1.5. If the market rises 10%, what does history suggest this stock might do?",
              "options": [
                "Rise roughly 15%",
                "Fall 15%",
                "Stay completely flat",
                "Rise exactly 10%"
              ],
              "correctIndex": 0
            },
            {
              "question": "A stock has a beta of 0.5. Roughly how volatile has it historically been compared to the market?",
              "options": [
                "About half as volatile",
                "Ten times as volatile",
                "Exactly as volatile",
                "Twice as volatile"
              ],
              "correctIndex": 0
            },
            {
              "question": "Which type of company is more likely to have a beta below 1?",
              "options": [
                "A high-growth biotech firm",
                "A newly IPO'd tech company",
                "A defensive utility company",
                "A speculative growth startup"
              ],
              "correctIndex": 2
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "High vs. Low Beta",
        "body": [
          "Above 1: generally more volatile, higher-risk-higher-reward — common among smaller or growth-oriented companies.",
          "Below 1: suggests relative stability, often seen in defensive sectors like utilities or consumer staples.",
          "Neither is automatically 'better' — a high-beta stock can meaningfully amplify gains in a rising market, while a low-beta stock is built to cushion a portfolio during exactly the kind of downturn the case study below covers."
        ]
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "Beta is calculated from historical price data, so it describes how a stock has behaved in the past, not a guarantee of the future.",
          "It's also just one dimension of risk — it says nothing about company-specific risks like a failed product launch."
        ],
        "deepDive": {
          "title": "How beta is actually calculated",
          "body": [
            "Statistically, beta is the covariance of a stock's returns with the market's returns, divided by the variance of the market's returns — in plain terms, it measures how much of the stock's movement has historically tracked the market's, scaled by how much more or less sharply it tends to move.",
            "Beta is normally calculated using a rolling window of historical data (commonly 2-5 years of monthly or weekly returns), which is exactly why the number itself isn't fixed — it recalculates and can drift meaningfully over time as a stock's own behavior, or the market's, changes."
          ]
        },
        "caseStudy": {
          "title": "High-beta vs. low-beta during the 2022 bear market",
          "body": [
            "2022 was a genuine real-world test of beta in action. Tesla — a stock with a 5-year beta that has run in the 1.5-1.8 range — had its single worst month in December 2022, falling about 36.7% that month alone, as high-growth and high-beta names were hit hardest by rising interest rates and slowing growth expectations.",
            "Procter & Gamble — a consumer-staples company with a beta around 0.38, one of the lowest among large-cap stocks — was one of several defensive names that continued paying and even raising its dividend straight through the same bear market, with far smaller price swings.",
            "Neither outcome was a coincidence or a surprise to anyone who'd checked each stock's beta beforehand — it's close to exactly what each stock's historical beta would have predicted for a sharp, broad market downturn.",
            "The takeaway: beta isn't just an academic statistic. In a real, recent, widely-experienced market decline, it correctly separated the stocks that amplified the pain from the ones that dampened it."
          ],
          "source": "Beta figures from stockanalysis.com (5-year beta, TSLA and PG statistics pages); Tesla's December 2022 monthly return and P&G's dividend continuation from contemporaneous market reporting",
          "sourceUrl": "https://stockanalysis.com/stocks/tsla/statistics/"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is a key limitation of beta?",
              "options": [
                "It measures a company's dividend yield instead of risk",
                "It can only be calculated once per company's entire lifetime",
                "It's the same number for every stock in the world",
                "It's calculated from historical data and doesn't guarantee future behavior"
              ],
              "correctIndex": 3
            },
            {
              "question": "What kind of risk does beta fail to capture?",
              "options": [
                "Company-specific risk, like a failed product launch",
                "Interest rate risk on bonds",
                "Currency exchange risk only",
                "Overall stock market risk"
              ],
              "correctIndex": 0
            },
            {
              "question": "Beta is best described as...",
              "options": [
                "One dimension of risk, not the complete picture",
                "A guarantee of future stock performance",
                "A measure of a company's total profit",
                "A replacement for reading a company's financial statements"
              ],
              "correctIndex": 0
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "analyst-ratings",
    "title": "Analyst Ratings",
    "descriptor": "Wall Street's opinion",
    "slides": [
      {
        "type": "content",
        "title": "What Are Analyst Ratings?",
        "body": [
          "Analyst ratings are recommendations — typically some version of Buy, Hold, or Sell — published by research analysts at banks and brokerages.",
          "They're usually paired with a price target for where the stock is expected to trade over the next 12 months.",
          "These come from 'sell-side' analysts — employed by banks and brokerages to publish research FOR investors, distinct from 'buy-side' analysts who work inside funds managing money directly. When financial media reports '[[analyst ratings|analyst-consensus]]' on a stock, it's almost always this sell-side research being referenced."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "Ratings reflect real research — detailed financial models and direct conversations with company management.",
          "They're often aggregated into a consensus view across many analysts covering the same stock.",
          "A meaningful shift in consensus — several analysts upgrading or downgrading in a short window — can itself move a stock's price, since it signals a change in how professional research broadly views the company's prospects."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What are analyst ratings?",
              "options": [
                "A company's own internal profit forecast",
                "A measure of a company's dividend yield",
                "Buy/Hold/Sell recommendations published by research analysts",
                "A government-mandated stock rating"
              ],
              "correctIndex": 2
            },
            {
              "question": "Who typically publishes analyst ratings?",
              "options": [
                "Research analysts at banks and brokerages",
                "Government regulators",
                "The company's own CEO",
                "Individual retail investors"
              ],
              "correctIndex": 0
            },
            {
              "question": "What often gets published alongside a Buy/Hold/Sell rating?",
              "options": [
                "The company's employee handbook",
                "The CEO's personal investment portfolio",
                "The company's tax return",
                "A 12-month price target"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "How Ratings Are Formed",
        "body": [
          "Analysts build detailed earnings models, track industry trends, and speak regularly with company management.",
          "From that research, they set a rating and a 12-month price target.",
          "Ratings are often scored numerically behind the scenes (e.g. Strong Buy=1 through Strong Sell=5) so a 'consensus' can be computed as a simple average across every analyst covering the stock, not just a rough head-count."
        ]
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "If 15 analysts cover a stock — 10 rate it Buy, 4 rate it Hold, and 1 rates it Sell — the consensus reads as a moderate-to-strong Buy."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "15 analysts covering one stock",
          "bars": [
            { "label": "Buy", "value": 10 },
            { "label": "Hold", "value": 4 },
            { "label": "Sell", "value": 1 }
          ]
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What do analysts typically build to arrive at a rating?",
              "options": [
                "A random number generator",
                "A popularity poll of retail investors",
                "Detailed financial models based on company research and industry trends",
                "A simple coin flip"
              ],
              "correctIndex": 2
            },
            {
              "question": "If 10 of 15 analysts rate a stock Buy, 4 rate it Hold, and 1 rates it Sell, how does the consensus read?",
              "options": [
                "A moderate-to-strong Buy",
                "Exactly neutral",
                "Impossible to interpret",
                "A strong Sell"
              ],
              "correctIndex": 0
            },
            {
              "question": "How should analyst ratings best be used?",
              "options": [
                "As one data point among many, not a signal to blindly act on",
                "As the single deciding factor for every investment decision",
                "As a replacement for reading a company's earnings report",
                "As a legally binding prediction"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading Ratings Sensibly",
        "body": [
          "Ratings are useful as one data point among many, and a gauge of professional sentiment.",
          "They shouldn't be treated as a signal to blindly act on by themselves.",
          "A near-unanimous consensus can feel especially reassuring — but as the case study below shows, near-unanimous agreement has, at least once in a very public way, turned out to be almost exactly wrong."
        ]
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "Analysts can be slow to change a rating after new information emerges, and ratings can cluster together (herd behavior).",
          "Analysts at banks with other business relationships with a company have historically faced conflict-of-interest criticism."
        ],
        "deepDive": {
          "title": "Why herding happens",
          "body": [
            "No individual analyst wants to be the lone 'Sell' rating on a stock everyone else loves, or the lone 'Buy' on one everyone else hates — being wrong alongside the consensus is far less career-damaging than being wrong alone, a well-documented incentive in institutional research known as career-risk herding.",
            "Investment banks have also historically had commercial relationships (underwriting, advisory work) with companies their own analysts cover, which regulators have required firms to disclose and, after early-2000s reforms, structurally separate from research more than in the past."
          ]
        },
        "caseStudy": {
          "title": "Enron: near-unanimous 'Buy' ratings before collapse",
          "body": [
            "As of October 18, 2001, all 15 analysts tracked by Thomson Financial/First Call rated energy trader Enron a 'Buy' — 12 of the 15 called it a 'Strong Buy.' At the time, Enron's stock had already fallen from around $90 to roughly $30 per share over the previous year.",
            "Even on November 8, 2001 — after Enron publicly disclosed it would need to restate nearly five years of earnings — 11 of the same 15 analysts still recommended buying the stock. Three rated it 'Hold' and just one rated it 'Strong Sell.'",
            "As one commentator noted at the time, the mathematical odds of a dozen-plus analysts all independently reaching the same bullish conclusion, even as the company's own disclosures worsened, are extremely low — a textbook example of herding rather than independent analysis.",
            "Enron filed for bankruptcy on December 2, 2001, then the largest bankruptcy in U.S. history. The episode became a central case study behind the early-2000s reforms requiring research analysts to be structurally separated from investment-banking relationships."
          ],
          "source": "Forbes, 'Enron Analysts: We Was Duped' (February 27, 2002)",
          "sourceUrl": "https://www.forbes.com/2002/02/27/0227analysts.html"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What is a known limitation of analyst ratings?",
              "options": [
                "Ratings never change once published",
                "Analysts can be slow to update ratings after new information emerges",
                "Analysts are required by law to always be correct",
                "Only one analyst is allowed to cover each stock"
              ],
              "correctIndex": 1
            },
            {
              "question": "What is 'herd behavior' among analysts?",
              "options": [
                "Analysts working exclusively in groups of ten",
                "Ratings tending to cluster together rather than diverge independently",
                "A rule requiring identical price targets",
                "A type of trading algorithm"
              ],
              "correctIndex": 1
            },
            {
              "question": "What conflict-of-interest concern has historically been raised about some analysts?",
              "options": [
                "Analysts never being allowed to publish opinions",
                "Analysts working only on weekends",
                "Analysts at banks with other business ties to a company they cover",
                "Analysts being paid too little"
              ],
              "correctIndex": 2
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "insider-trading",
    "title": "Insider Trading",
    "descriptor": "Following the insiders",
    "slides": [
      {
        "type": "content",
        "title": "What Does 'Insider Trading' Mean Here?",
        "body": [
          "In this context, it refers to the legal, publicly disclosed buying and selling of a company's stock by its own executives and directors.",
          "That's a different (and legal) thing from the illegal use of material non-public information, which is a separate and prosecutable matter.",
          "The distinction matters because news headlines use the same two words for both — always check whether a story is describing a disclosed, legal [[Form 4|form-4]] filing (this course's subject) or an allegation of trading on undisclosed material information (a securities-fraud matter handled by the SEC and Department of Justice, not something this course covers)."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "Insiders arguably know their company better than anyone else.",
          "Their own trades — made with their own money — can be a genuine signal about their confidence in the business.",
          "Because this data is fully public, it's also one of the few genuine informational edges available to any retail investor willing to look — no special access required, just checking disclosed filings anyone can read."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "In this context, what does 'insider trading' refer to?",
              "options": [
                "A type of stock split",
                "Trading only allowed for company founders",
                "Legal, disclosed buying/selling of a company's stock by its own executives and directors",
                "The illegal use of non-public information"
              ],
              "correctIndex": 2
            },
            {
              "question": "Is the legal insider trading discussed here the same as the illegal kind sometimes reported in the news?",
              "options": [
                "No — the illegal kind involves trading on material non-public information, a separate matter",
                "No, the legal kind is always fraud",
                "Yes, but only for foreign companies",
                "Yes, they are exactly the same thing"
              ],
              "correctIndex": 0
            },
            {
              "question": "Why do investors pay attention to insider trades?",
              "options": [
                "Insiders arguably know their company better than anyone else",
                "It determines the company's stock ticker",
                "It's required reading for tax purposes",
                "Insider trades are always guaranteed profitable"
              ],
              "correctIndex": 0
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "How It's Tracked",
        "body": [
          "Insiders in the U.S. are required to report their trades to the SEC, and that data becomes public.",
          "This disclosure requirement is what insider-activity trackers are built on.",
          "Specifically: an insider must file a [[Form 4|form-4]] within two business days of a trade — a tight window that means insider activity data is genuinely recent, not stale historical filings, by the time it's publicly visible."
        ]
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Several executives buying meaningful amounts of stock with their own money within the same month is often read as a vote of confidence.",
          "The reverse concentration matters too: a single insider selling a small fraction of their holdings is unremarkable, but several DIFFERENT insiders independently selling large stakes within a short window is a more notable pattern worth a closer look."
        ]
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "How does insider trading data become public in the U.S.?",
              "options": [
                "It's leaked by anonymous whistleblowers only",
                "Insiders are required to report their trades to the SEC",
                "Companies voluntarily post it on social media",
                "It never becomes public"
              ],
              "correctIndex": 1
            },
            {
              "question": "What might a cluster of executives buying stock with their own money suggest?",
              "options": [
                "A vote of confidence in the company",
                "That the company is about to go bankrupt",
                "That the stock is about to be delisted",
                "Nothing at all — it's random"
              ],
              "correctIndex": 0
            },
            {
              "question": "Should a single insider sale always be read as a bad sign?",
              "options": [
                "Yes, but only on Fridays",
                "Yes, it always means the company is failing",
                "No — insiders sell for many mundane reasons too",
                "No, because insiders can never legally sell shares"
              ],
              "correctIndex": 2
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "Reading the Signal",
        "body": [
          "Insider activity is best read in aggregate and in context.",
          "A single trade means little; a sustained pattern of buying or selling across multiple insiders over time carries more signal — the case study below is a real, academically-studied example of exactly this kind of sustained pattern showing up well before public news caught up."
        ]
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "Insiders also sell for entirely mundane reasons — diversification, paying taxes, or exercising options that are about to expire.",
          "Selling alone isn't necessarily a red flag the way a cluster of buying can be a positive one."
        ],
        "deepDive": {
          "title": "Scheduled sales vs. discretionary sales",
          "body": [
            "Many insider sales happen under a [[10b5-1 plan|10b5-1-plan]] — a pre-arranged trading schedule set up months in advance, often specifically to give the insider a legal way to sell periodically without ever being accused of trading on whatever information they happen to know at the time.",
            "A scheduled 10b5-1 sale carries essentially no signal about the insider's current view — most trackers and terminals flag whether a given trade was scheduled or discretionary for exactly this reason, and it's worth checking before reading anything into a single sale."
          ]
        },
        "caseStudy": {
          "title": "Bank insiders selling ahead of the 2008 financial crisis",
          "body": [
            "Academic research examining bank insider trading found that starting in the second quarter of 2006 — right as U.S. housing prices first began to decline — insiders at banks with high exposure to subprime mortgages significantly increased their stock sales relative to insiders at lower-exposure banks.",
            "At high-exposure banks, the number of insiders reducing their holdings rose about 12% more than at low-exposure banks that same year, and the dollar value of their sales ran meaningfully higher — a pattern the researchers found consistently across the run-up to the crisis.",
            "Critically, this insider selling preceded the actual drop in these banks' stock prices (and the jump in their credit-default-swap spreads, a market gauge of default risk) by at least 12 months — insiders were, in aggregate, selling well before the broader market recognized the severity of what was coming.",
            "This is a real, legal, fully-disclosed example of exactly what this course describes: a single insider's sale means little, but a sustained, aggregate pattern across many insiders — read in the right context — was a genuine leading indicator, visible in public filings a year before the 2008 crisis became common knowledge."
          ],
          "source": "CEPR VoxEU, 'Anticipating the financial crisis: Evidence from insider trading in banks' (Harvard Law School Forum on Corporate Governance summary, 2012)",
          "sourceUrl": "http://corpgov.law.harvard.edu/2012/03/30/trading-by-bank-insiders-before-and-during-the-financial-crisis/"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "How is insider trading data best interpreted?",
              "options": [
                "By only looking at the CEO's trades",
                "In aggregate and in context, not from a single trade",
                "By assuming every trade is illegal",
                "By ignoring it entirely"
              ],
              "correctIndex": 1
            },
            {
              "question": "Which of these is a common, non-alarming reason an insider might sell shares?",
              "options": [
                "The stock exchange requires it annually",
                "The company is definitely going bankrupt",
                "Diversifying their personal wealth or paying taxes",
                "It's illegal for them to hold shares longer"
              ],
              "correctIndex": 2
            },
            {
              "question": "What carries more signal: a single trade or a sustained pattern across multiple insiders?",
              "options": [
                "A single trade by one person",
                "Neither carries any signal",
                "The company's stock ticker length",
                "A sustained pattern across multiple insiders"
              ],
              "correctIndex": 3
            }
          ]
        }
      }
    ]
  },
  {
    "topicId": "dca",
    "title": "DCA",
    "descriptor": "Steady, automatic investing",
    "toolHref": "/tools/dca",
    "toolLabel": "DCA Simulator",
    "slides": [
      {
        "type": "content",
        "title": "What Is Dollar-Cost Averaging?",
        "body": [
          "Dollar-cost averaging (DCA) is an investing strategy where you invest a fixed dollar amount at regular intervals.",
          "You invest that same amount regardless of whether the price is up or down that day.",
          "It exists largely as a behavioral discipline as much as a mathematical one — it replaces the genuinely impossible task of picking the single best moment to invest with a simple, repeatable rule that removes the decision entirely."
        ]
      },
      {
        "type": "content",
        "title": "Why It Matters",
        "body": [
          "DCA removes the temptation — and the near-impossible task — of trying to time the market.",
          "It smooths out the emotional impact of investing a lump sum right before a downturn.",
          "For most people, DCA isn't really a choice at all so much as a natural consequence of investing part of every paycheck — 401(k) contributions and automatic brokerage transfers are DCA by default, whether or not the investor thinks of it that way."
        ],
        "showNewsExample": true
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "What does DCA stand for?",
              "options": [
                "Discounted Cash Allocation",
                "Dollar-Cost Averaging",
                "Daily Compounding Adjustment",
                "Direct Capital Allocation"
              ],
              "correctIndex": 1
            },
            {
              "question": "What does DCA involve?",
              "options": [
                "Investing a fixed dollar amount at regular intervals, regardless of price",
                "Selling a fixed amount of stock every month",
                "Investing your entire savings in a single stock",
                "Only buying stocks when prices are falling"
              ],
              "correctIndex": 0
            },
            {
              "question": "What is the main appeal of DCA?",
              "options": [
                "It guarantees a fixed dividend payment",
                "It eliminates all investment risk",
                "It always produces higher returns than any other strategy",
                "It removes the temptation to try to time the market"
              ],
              "correctIndex": 3
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "How It Works",
        "body": [
          "Because the dollar amount is fixed, you automatically buy more shares when prices are low and fewer shares when prices are high.",
          "This is the entire mechanism behind DCA's effect on [[average cost basis|average-cost-basis]] — no market judgment required, just consistent, mechanical execution of the same rule regardless of price."
        ]
      },
      {
        "type": "content",
        "title": "A Worked Example",
        "body": [
          "Investing $200/month for 3 months at prices of $20, $10, and $20 buys 10 + 20 + 10 = 40 shares.",
          "That's an average cost of $15/share — lower than the simple average of the three prices ($16.67), because the $10 month bought disproportionately more shares."
        ],
        "visual": {
          "type": "comparison-bar",
          "title": "DCA's average cost vs. the simple average of the 3 prices",
          "unit": "$",
          "bars": [
            { "label": "Simple average of $20/$10/$20", "value": 16.67 },
            { "label": "DCA's actual average cost per share", "value": 15, "highlight": true }
          ]
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "With a fixed dollar amount, what happens when the price is low?",
              "options": [
                "You stop investing entirely",
                "You automatically buy more shares",
                "The dollar amount doubles",
                "You automatically buy fewer shares"
              ],
              "correctIndex": 1
            },
            {
              "question": "Investing $200/month for 3 months at prices of $20, $10, and $20 buys how many total shares?",
              "options": [
                "60 shares",
                "40 shares",
                "30 shares",
                "20 shares"
              ],
              "correctIndex": 1,
              "explanation": "10 + 20 + 10 = 40 shares."
            },
            {
              "question": "Who commonly uses DCA as a default strategy?",
              "options": [
                "Only company executives",
                "Only bond investors",
                "Anyone investing part of every paycheck regularly",
                "Only day traders"
              ],
              "correctIndex": 2
            }
          ]
        }
      },
      {
        "type": "content",
        "title": "When People Use It",
        "body": [
          "It's a popular default for regular contributions, like investing part of every paycheck.",
          "It's also a common choice for anyone nervous about the timing of a large lump-sum investment — inheriting a large sum, or receiving a bonus, are common real-world moments people choose to DCA in gradually rather than invest all at once."
        ]
      },
      {
        "type": "content",
        "title": "Limitations",
        "body": [
          "DCA isn't guaranteed to outperform investing a lump sum all at once.",
          "In a market that trends upward over time, investing the full amount immediately has historically outperformed DCA on average, since more money spends more time invested — the case study below cites the actual, well-known research behind that claim."
        ],
        "deepDive": {
          "title": "So why does anyone recommend DCA at all?",
          "body": [
            "The historical outperformance of lump-sum investing is an AVERAGE across many periods — it doesn't mean lump-sum wins every single time, and the periods where DCA wins tend to be exactly the periods (like right before a downturn) that feel worst emotionally to have gone all-in on.",
            "DCA is best understood as trading away a little expected return for a real, measurable reduction in regret risk and short-term volatility exposure — a legitimate trade for an investor who would otherwise feel too anxious to invest a lump sum at all, or might panic-sell after a bad entry point."
          ]
        },
        "caseStudy": {
          "title": "Vanguard's research on DCA vs. lump-sum investing",
          "body": [
            "Vanguard, one of the largest asset managers in the world, has published its own research directly comparing dollar-cost averaging against investing a lump sum immediately, using long historical return data across U.S. and international markets.",
            "The consistent finding: investing a lump sum immediately has historically outperformed phasing the same money in gradually roughly two-thirds of the time, by a modest but real average margin — simply because markets rise more often than they fall, so money invested sooner spends more time compounding.",
            "Vanguard's own research explicitly frames this as a trade-off, not a simple 'DCA is wrong' conclusion — the firm's guidance acknowledges that gradually phasing in a large sum can meaningfully reduce regret and anxiety for investors who would otherwise struggle to invest it all at once, even while noting the numbers favor lump-sum on average.",
            "This is a rare case in investing where a large, credible asset manager has published research directly quantifying a piece of conventional wisdom — turning 'DCA is safer' from a vague intuition into a specific, real, measurable trade-off."
          ],
          "source": "Vanguard, research on cost averaging vs. lump-sum investing (Finlay & Zorn, 'Cost averaging: Invest now or temporarily hold your cash?', Vanguard research)",
          "sourceUrl": "https://investor.vanguard.com/investor-resources-education/online-trading/dollar-cost-averaging-vs-lump-sum"
        }
      },
      {
        "type": "quiz",
        "quiz": {
          "questions": [
            {
              "question": "Does DCA always outperform investing a lump sum immediately?",
              "options": [
                "No — in an upward-trending market, investing a lump sum immediately has historically outperformed DCA on average",
                "DCA and lump-sum investing always produce identical results",
                "Yes, but only in a down market",
                "Yes, always, in every market condition"
              ],
              "correctIndex": 0
            },
            {
              "question": "Why does a lump sum tend to outperform DCA in a rising market?",
              "options": [
                "DCA is illegal in rising markets",
                "Lump sum investing removes all risk",
                "More money spends more time invested and growing",
                "Lump sum investors pay lower taxes"
              ],
              "correctIndex": 2
            },
            {
              "question": "What does DCA trade off in exchange for steadier, more manageable investing habits?",
              "options": [
                "Some expected return",
                "The ability to ever sell your shares",
                "All investment risk",
                "Access to dividends"
              ],
              "correctIndex": 0
            }
          ]
        }
      }
    ]
  }
];

export function getCourse(topicId: string): Course | undefined {
  return COURSES.find((course) => course.topicId === topicId);
}
