import React from 'react';

export default function CountryEmergency({ numbers }) {
  if (!numbers) return null;
  const { country, police, ambulance, fire, general } = numbers;

  const Button = ({ label, num }) => (
    <a className="country-emergency__btn" href={`tel:${num}`}>
      <span className="country-emergency__label">{label}</span>
      <span className="country-emergency__num">{num}</span>
    </a>
  );

  return (
    <div className="country-emergency">
      <div className="country-emergency__title">
        <span>National Emergency · {country}</span>
        <span className="country-emergency__always">Always available offline</span>
      </div>
      <div className="country-emergency__grid">
        <Button label="General" num={general} />
        <Button label="Police" num={police} />
        <Button label="Ambulance" num={ambulance} />
        <Button label="Fire" num={fire} />
      </div>
    </div>
  );
}
