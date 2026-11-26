export default function DecisionTrace({ steps }) {
  return (
    <details className="trace">
      <summary>How the agent decided ({steps.length} steps)</summary>
      <ol>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
