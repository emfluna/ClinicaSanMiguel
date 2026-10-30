
export const aiService = {
  /**
   * Genera una respuesta basada en una consulta libre del profesional.
   */
  async askAssistant(prompt: string) {
    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al llamar al servicio de IA.");
      }
      return data.text;
    } catch (error: any) {
      console.error("AI Service Error:", error);
      return "Lo siento, el servicio de inteligencia artificial no está disponible en este momento. Por favor, intente más tarde.";
    }
  },

  /**
   * Crea instrucciones de cuidado personalizadas para el paciente.
   */
  async generatePatientCare(procedure: string, patientName: string) {
    const prompt = `Genera instrucciones de cuidados post-operatorios claras y empáticas para el paciente ${patientName} que se ha sometido a: ${procedure}. Incluye qué evitar, medicación común sugerida y signos de alarma.`;
    return this.askAssistant(prompt);
  },

  /**
   * Resume el historial clínico para una revisión rápida.
   */
  async summarizeHistory(notes: string[]) {
    if (notes.length === 0) return "No hay notas suficientes para resumir.";
    const prompt = `Resume las siguientes notas clínicas de forma estructurada destacando la evolución del paciente y tratamientos pendientes: \n${notes.join('\n')}`;
    return this.askAssistant(prompt);
  }
};

