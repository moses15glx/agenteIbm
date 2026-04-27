export async function callAgent(input) {
  const response = await fetch("URL_DO_AGENT", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input
    })
  });

  const data = await response.json();
  return data.output || "Erro";
}