// supabase/functions/exportar-dados/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Trata CORS (Permite acesso de qualquer lugar/browser)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    
    // 2. Pega os parâmetros da URL
    const token = url.searchParams.get('token')
    const id_modulo = url.searchParams.get('id')
    const pagina = url.searchParams.get('pagina') || '1'
    
    // 3. Validação Básica
    if (!token || !id_modulo) {
        throw new Error("Parâmetros 'token' e 'id' são obrigatórios.")
    }

    // 4. Conecta no Supabase (Usando a chave interna do servidor)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // 5. Chama a nossa função SQL (que já valida a senha)
    const { data, error } = await supabase.rpc('api_dados_externos', {
      token_acesso: token,
      id_modulo: Number(id_modulo),
      pagina: Number(pagina),
      tamanho_pagina: 2000 // Limite maior para exportação
    })

    if (error) throw error

    // 6. Retorna o JSON puro (Perfeito para Power BI/Excel)
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})