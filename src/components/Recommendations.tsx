interface RecommendationsProps {
  items: string[];
}

const Recommendations = ({ items }: RecommendationsProps) => (
  <section>
    <h4>Recommendations</h4>
    {items.length ? (
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="workflow-panel__empty">Add devices to see suggested cables.</p>
    )}
  </section>
);

export default Recommendations;
