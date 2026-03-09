import readline from "node:readline/promises";
import process from "node:process";

export async function promptForAssistanceInputs(assistance, options) {
  if (!shouldPromptForAssistance(assistance, options)) {
    return null;
  }

  const outstandingInputs = assistance.requestedInputs.filter((input) => !getExistingValue(options, input.id));

  if (!outstandingInputs.length) {
    return null;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const confirmation = normalizeYesNo(
      await rl.question("\nQuieres aportar ahora esas URLs para reintentar automaticamente? [y/N]: "),
    );

    if (!confirmation) {
      return null;
    }

    const answers = {};

    for (const input of outstandingInputs) {
      const response = (
        await rl.question(
          `${input.label}${input.required ? " (obligatorio)" : " (opcional)"}: `,
        )
      ).trim();

      if (!response) {
        continue;
      }

      if (!isHttpUrl(response)) {
        console.log(`- Valor ignorado para ${input.label}: no parece una URL http/https valida.`);
        continue;
      }

      answers[input.id] = response;
    }

    const missingRequired = outstandingInputs.filter((input) => input.required && !answers[input.id]);

    if (missingRequired.length) {
      console.log("- No se aportaron todas las URLs obligatorias; no se reintentara automaticamente.");
      return null;
    }

    return answers;
  } finally {
    rl.close();
  }
}

export function applyAssistanceInputsToParsed(parsed, answers, command) {
  if (!answers) {
    return parsed;
  }

  const next = {
    ...parsed,
  };

  if (answers.home_url) {
    next.homeUrl = answers.home_url;
  }

  if (answers.plp_url) {
    next.plpUrl = answers.plp_url;

    if (command === "scrape" && !next.categoryUrls.length) {
      next.categoryUrls = [answers.plp_url];
    }
  }

  if (answers.search_url) {
    next.searchUrl = answers.search_url;
  }

  if (answers.pdp_url) {
    next.pdpUrl = answers.pdp_url;
  }

  return next;
}

export function hasGuidedSampleUrls(options) {
  return Boolean(options.homeUrl || options.plpUrl || options.searchUrl || options.pdpUrl);
}

function shouldPromptForAssistance(assistance, options) {
  if (!assistance || assistance.status !== "needs_user_input") {
    return false;
  }

  if (options.interactiveAssistance === false) {
    return false;
  }

  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function getExistingValue(options, id) {
  switch (id) {
    case "home_url":
      return options.homeUrl || options.entryUrl;
    case "plp_url":
      return options.plpUrl || options.categoryUrls?.[0] || "";
    case "search_url":
      return options.searchUrl || "";
    case "pdp_url":
      return options.pdpUrl || "";
    default:
      return "";
  }
}

function normalizeYesNo(value) {
  return ["y", "yes", "s", "si"].includes(String(value || "").trim().toLowerCase());
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}
