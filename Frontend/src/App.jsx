import React, { useState } from 'react';
import styles from './App.module.scss';

export default function App() {
  const [activeTab, setActiveTab] = useState('all');

  const services = [
    {
      id: 'dl',
      title: 'Driving License Services',
      description: 'Apply for learner license, DL renewal, duplicate DL, and address update online.',
      icon: '🆔'
    },
    {
      id: 'rc',
      title: 'Vehicle Registration (RC)',
      description: 'Register new vehicle, transfer ownership, renewal of RC, and fitness certificate.',
      icon: '🚘'
    },
    {
      id: 'challan',
      title: 'E-Challan Payment',
      description: 'Check traffic violation status, pay online challans instantly across all states.',
      icon: '📄'
    },
    {
      id: 'permit',
      title: 'National Permit & Taxation',
      description: 'Pay road taxes online, apply for goods permit, and commercial vehicle authorizations.',
      icon: '🚚'
    }
  ];

  return (
    <div className="app">
      {/* Top Navbar */}
      <header className={styles.appHeader}>
        <div className="container">
          <div className={styles.navContainer}>
            <div className={styles.brand}>
              <div className={styles.logoIcon}>🇮🇳</div>
              <div className={styles.brandTitle}>
                Parivahan <span>Revamp</span>
              </div>
            </div>
            <ul className={styles.navLinks}>
              <li><a href="#services">Services</a></li>
              <li><a href="#challan">E-Challan</a></li>
              <li><a href="#status">Application Status</a></li>
              <li><a href="#backend">Backend (Python API)</a></li>
            </ul>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        <section className={styles.heroSection}>
          <div className={styles.heroBadge}>
            ✨ Modernized Ministry of Road Transport & Highways Portal
          </div>
          <h1 className={styles.heroTitle}>
            Next-Gen Transport Services <span>Simplified</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Seamless access to driving licenses, vehicle registrations, e-challans, and national permits all powered by a modern React Frontend and Python Backend architecture.
          </p>
        </section>

        {/* Services Grid */}
        <section id="services" className={styles.servicesGrid}>
          {services.map((service) => (
            <div key={service.id} className={styles.serviceCard}>
              <div className={styles.cardIcon}>{service.icon}</div>
              <h3 className={styles.cardTitle}>{service.title}</h3>
              <p className={styles.cardDesc}>{service.description}</p>
            </div>
          ))}
        </section>

        {/* Python Backend Collaboration Panel */}
        <section id="backend" className={styles.backendStatusCard}>
          <div className={styles.statusHeader}>
            <span className={styles.statusTitle}>⚡ Backend Integration Status</span>
            <span className={styles.badgePython}>Python FastAPI / Flask Ready</span>
          </div>
          <p className={styles.statusText}>
            The frontend is pre-configured to communicate with your friend's Python API endpoint at <code>http://localhost:8000/api</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
