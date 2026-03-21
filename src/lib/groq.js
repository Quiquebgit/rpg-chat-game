import Groq from 'groq-sdk'

const groqClient = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
})

// Listas de modelos en orden de preferencia. Cada petición empieza siempre desde el índice 0.
const NARRATOR_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'moonshotai/kimi-k2-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
]

const MECHANICS_MODELS = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]

// Error que se lanza cuando todos los modelos de la lista devuelven 429
export class ModelsBusyError extends Error {
  constructor(role) {
    super(`Todos los modelos de ${role} están ocupados (429)`)
    this.name = 'ModelsBusyError'
  }
}

// Itera la lista de modelos intentando makeRequest(model) en cada uno.
// Solo avanza al siguiente si recibe 429. Cualquier otro error se propaga.
// Si todos fallan con 429, lanza ModelsBusyError.
async function tryModels(models, role, makeRequest) {
  for (const model of models) {
    try {
      console.log(`[groq/${role}] modelo: ${model}`)
      return await makeRequest(model)
    } catch (err) {
      const status = err?.status || err?.error?.status
      if (status === 429 || status === 503) {
        console.warn(`[groq/${role}] ${model}: ${status} — probando siguiente…`)
        continue
      }
      throw err
    }
  }
  throw new ModelsBusyError(role)
}

// Modelo mecánico: JSON estricto, reglas del juego, sin narrativa.
// tools y toolExecutors son opcionales: cuando se pasan, se usan en lugar de ninguna tool.
export async function callMechanicsModel(systemPrompt, userPrompt, {
  json = true,
  maxTokens = 400,
  temperature = 0.1,
  useTools = false,
  tools: customTools = null,
  toolExecutors: customExecutors = null,
} = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const tools = useTools ? (customTools || undefined) : undefined
  const executors = customExecutors || {}

  return tryModels(MECHANICS_MODELS, 'mecánico', async (model) => {
    // Primera llamada: con tools si aplica. Sin response_format para no conflictar con tool_choice.
    const completion = await groqClient.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
      ...(json && !tools ? { response_format: { type: 'json_object' } } : {}),
    })

    const responseMessage = completion.choices[0]?.message

    // Si el modelo llamó a una herramienta, ejecutarla y hacer segunda llamada con el mismo modelo
    if (responseMessage?.tool_calls?.length > 0) {
      const toolResultMessages = []
      for (const toolCall of responseMessage.tool_calls) {
        const fn = executors[toolCall.function.name]
        let result = null
        if (fn) {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            result = await fn(args)
          } catch (e) {
            console.error(`Error ejecutando tool "${toolCall.function.name}":`, e)
          }
        }
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result ? JSON.stringify(result) : 'ERROR: sin resultados. Omite este campo.',
        })
      }
      const completion2 = await groqClient.chat.completions.create({
        model,
        messages: [...messages, responseMessage, ...toolResultMessages],
        max_tokens: maxTokens,
        temperature,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      })
      return completion2.choices[0]?.message?.content?.trim() || null
    }

    return responseMessage?.content?.trim() || null
  })
}

// Modelos del Director de Guion — inteligencia máxima, latencia no crítica
const DIRECTOR_MODELS = [
  'moonshotai/kimi-k2-instruct',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
]

// Modelo director: planificación narrativa, siempre devuelve JSON
export async function callDirectorModel(systemPrompt, userPrompt) {
  return tryModels(DIRECTOR_MODELS, 'director', async (model) => {
    const completion = await groqClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })
    return completion.choices[0]?.message?.content?.trim() || null
  })
}

// Modelo narrador: texto dramático libre, sin JSON
export async function callNarratorModel(systemPrompt, userPrompt) {
  return tryModels(NARRATOR_MODELS, 'narrador', async (model) => {
    const completion = await groqClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.85,
    })
    return completion.choices[0]?.message?.content?.trim() || null
  })
}
