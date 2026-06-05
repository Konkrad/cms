const AFFILIATION_LABELS: Record<string, string> = {
  master: "Master's Degree",
  summer: "Summer School",
  "Item 1": "EITDigital Employee",
  "Item 2": "Friends / Network",
  "Item 3": "PhD",
  "Item 4": "Speed Master",
  "Item 5": "EITDigital Accelerator",
};

const TRACK_LABELS: Record<string, string> = {
  aus: "Autonomous Systems (AUS)",
  cni: "Cloud and Network Infrastructures (CNI)",
  ccs: "Cloud Computing and Services (CCS)",
  cse: "Cyber Security (CSE)",
  dsc: "Data Science (DSC)",
  dm: "Digital Manufacturing (DM)",
  dmt: "Digital Media Technology (DMT)",
  dss: "Distributed Systems and Services (DSS)",
  es: "Embedded Systems (ES)",
  emai: "Emotion Artificial Intelligence (EMAI)",
  ft: "Fintech (FT)",
  ftb: "Fintech for Business (FTB)",
  hcid: "Human Computer Interaction and Design (HCID)",
  ita: "Internet Technology and Architecture (ITA)",
  sap: "Security and Privacy (SaP)",
  sde: "Service Design and Engineering (SDE)",
  ssa: "Software and Service Architectures (SSA)",
  vcc: "Visual Computing and Communication (VCC)",
};

const UNIVERSITY_LABELS: Record<string, string> = {
  aalto_university: "Aalto University",
  babes_bolyai_university: "Babeș-Bolyai University",
  bme_budapest_university_of_technology_and_economics: "BME Budapest",
  delft_university_of_technology: "TU Delft",
  eindhoven_university: "TU Eindhoven",
  elte_eotvos_lorand_university: "ELTE Budapest",
  eurecom: "EURECOM",
  institut_mines_telecom: "Institut Mines-Télécom",
  kth_royal_institute_of_technology: "KTH Stockholm",
  middle_east_technical_university: "METU Ankara",
  polimi_polytechnic_university_of_milan: "Politecnico di Milano",
  polytechnic_university_of_bari: "Polytechnic University of Bari",
  riga_technical_university: "Riga Technical University",
  saarland_university: "Saarland University",
  sorbonne_university: "Sorbonne University",
  stockholm_university: "Stockholm University",
  taltech_tallinn_university_of_technology: "TalTech Tallinn",
  tampere_university: "Tampere University",
  tu_berlin: "TU Berlin",
  tu_darmstadt: "TU Darmstadt",
  tu_eindhoven: "TU Eindhoven",
  ucl_university_college_london: "UCL London",
  unibo_university_of_bologna: "University of Bologna",
  unitn_university_of_trento: "University of Trento",
  universite_cote_d_azur: "Université Côte d'Azur",
  universite_pierre_et_marie_curie: "UPMC Paris",
  university_of_nice_sophia_antipolis: "University of Nice",
  university_of_rennes_1: "University of Rennes 1",
  university_of_the_aegea: "University of the Aegean",
  university_of_twente: "University of Twente",
  upm_universidad_politecnica_de_madrid: "UPM Madrid",
  ups_universite_paris_sud: "Université Paris-Sud",
  utu_university_of_turku: "University of Turku",
};

const SUMMER_SCHOOL_LABELS: Record<string, string> = {
  "2013_eindhoven_health_and_wellbeing": "2013 - Eindhoven, Health and Wellbeing",
  "2013_trento_service_design_for_quality_of_life": "2013 - Trento, Service Design for Quality of Life",
  "2014_eindhoven_health_and_wellbeing": "2014 - Eindhoven, Health and Wellbeing",
  "2014_helsinki_smart_spaces": "2014 - Helsinki, Smart Spaces",
  "2014_nice_urban_life_and_mobility": "2014 - Nice, Urban Life and Mobility",
  "2014_oulu_helsinki_future_cloud": "2014 - Oulu/Helsinki, Future Cloud",
  "2014_stockholm_future_networking_systems": "2014 - Stockholm, Future Networking Systems",
  "2014_stockholm_karlsruhe_smart_energy_systems": "2014 - Stockholm/Karlsruhe, Smart Energy Systems",
  "2014_trento_cyber_physical_systems": "2014 - Trento, Cyber-Physical Systems",
  "2014_trento_privacy_security_and_trust": "2014 - Trento, Privacy, Security & Trust",
  "2015_eindhoven_health_and_wellbeing": "2015 - Eindhoven, Health and Wellbeing",
  "2015_helsinki_smart_spaces": "2015 - Helsinki, Smart Spaces",
  "2015_karlsruhe_smart_energy_systems": "2015 - Karlsruhe, Smart Energy Systems",
  "2015_london_urban_life_and_mobility": "2015 - London, Urban Life and Mobility",
  "2015_stockholm_cyber_physical_systems": "2015 - Stockholm, Cyber-Physical Systems",
  "2015_stockholm_future_cloud": "2015 - Stockholm, Future Cloud",
  "2015_stockholm_future_networking_solutions": "2015 - Stockholm, Future Networking Solutions",
  "2015_trento_privacy_security_and_trust": "2015 - Trento, Privacy, Security & Trust",
  "2016_eindhoven_health_and_wellbeing_i": "2016 - Eindhoven, Health & Wellbeing I",
  "2016_helsinki_smart_spaces": "2016 - Helsinki, Smart Spaces",
  "2016_karlsruhe_smart_energy_systems": "2016 - Karlsruhe, Smart Energy Systems",
  "2016_london_health_and_wellbeing_ii": "2016 - London, Health & Wellbeing II",
  "2016_paris_cyber_physical_systems": "2016 - Paris, Cyber-Physical Systems",
  "2016_paris_urban_life_and_mobility": "2016 - Paris, Urban Life and Mobility",
  "2016_stockholm_future_cloud": "2016 - Stockholm, Future Cloud",
  "2016_stockholm_future_networking_solutions": "2016 - Stockholm, Future Networking Solutions",
  "2016_trento_privacy_security_and_trust": "2016 - Trento, Privacy, Security & Trust",
  "2017_berlin_citizen_participation_and_city_governance": "2017 - Berlin, Citizen Participation and City Governance",
  "2017_budapest_machine_learning_for_financial_data": "2017 - Budapest, Machine Learning for Financial Data",
  "2017_eindhoven_independent_living_and_long_term_care": "2017 - Eindhoven, Independent Living and Long-term Care",
  "2017_helsinki_retail_markets_consumer_engagement": "2017 - Helsinki, Retail, Markets, Consumer Engagement",
  "2017_lisbon_healthy_lifestyle_and_occupational_fitness": "2017 - Lisbon, Healthy Lifestyle and Occupational Fitness",
  "2017_munich_decentralized_production": "2017 - Munich, Decentralized Production",
  "2017_nice_urban_mobility_safety_and_exploration": "2017 - Nice, Urban Mobility, Safety and Exploration",
  "2017_stockholm_big_data_analytics": "2017 - Stockholm, Big Data Analytics",
  "2017_stockholm_internet_of_things_and_business_transformation": "2017 - Stockholm, Internet of Things and Business Transformation",
  "2017_trento_cybersecurity_and_privacy": "2017 - Trento, Cybersecurity and Privacy",
  "2018_budapest_machine_learning_for_financial_data": "2018 - Budapest, Machine Learning for Financial Data",
  "2018_eindhoven_healthy_lifestyle_and_behavioural_change": "2018 - Eindhoven, Healthy Lifestyle and Behavioural Change",
  "2018_helsinki_retail_markets_consumer_engagement": "2018 - Helsinki, Retail, Markets, Consumer Engagement",
  "2018_lisbon_longer_independent_living": "2018 - Lisbon, Longer Independent Living",
  "2018_munich_iot_platforms_for_industry_4_0": "2018 - Munich, IoT Platforms for Industry 4.0",
  "2018_rennes_predictive_analytics_big_data_mobility_and_open_platforms_for_an_efficient_and_participative_city": "2018 - Rennes, Predictive Analytics, Big Data, Mobility and Open Platforms",
  "2018_stockholm_big_data_analytics": "2018 - Stockholm, Big Data Analytics",
  "2018_stockholm_internet_of_things_and_business_transformation": "2018 - Stockholm, Internet of Things and Business Transformation",
  "2018_tallinn_integrating_personalised_mobility_solutions_for_digital_cities": "2018 - Tallinn, Integrating Personalised Mobility Solutions for Digital Cities",
  "2018_trento_cybersecurity_and_privacy": "2018 - Trento, Cybersecurity and Privacy",
  "2019_bologna_data_driven_manufacturing_with_industry_4_0": "2019 - Bologna, Data Driven Manufacturing with Industry 4.0",
  "2019_budapest_machine_learning_for_financial_data": "2019 - Budapest, Machine Learning for Financial Data",
  "2019_eindhoven_healthy_lifestyle_and_behavioural_change": "2019 - Eindhoven, Healthy Lifestyle and Behavioural Change",
  "2019_helsinki_disrupting_retail_digitalisation_growth_and_user_engagement": "2019 - Helsinki, Disrupting Retail – Digitalisation, Growth, and User Engagement",
  "2019_lisbon_longer_independent_living": "2019 - Lisbon, Longer Independent Living",
  "2019_ljubljana_digital_transformation_for_resilient_cities": "2019 - Ljubljana, Digital Transformation for Resilient Cities",
  "2019_munich_iot_platforms_for_industry_4_0": "2019 - Munich, IoT Platforms for Industry 4.0",
  "2019_rennes_unleashing_the_power_of_data_for_better_cities": "2019 - Rennes, Unleashing the Power of Data for Better Cities",
  "2019_stockholm_big_data_analytics": "2019 - Stockholm, Big Data Analytics",
  "2019_stockholm_internet_of_things_and_business_transformation": "2019 - Stockholm, Internet of Things and Business Transformation",
  "2019_tallinn_integrating_personalised_mobility_solutions": "2019 - Tallinn, Integrating Personalised Mobility Solutions",
  "2019_trento_digital_cities_as_infrastructures_for_smart_mobility": "2019 - Trento, Digital Cities as Infrastructures for Smart Mobility",
  "2020_big_data_analytics": "2020 - Big Data Analytics",
  "2020_data_visualisation_and_connectivity_for_healthcare": "2020 - Data, Visualisation, and Connectivity for Healthcare",
  "2020_design_thinking_and_scaling_services_for_cities": "2020 - Design Thinking and Scaling Services for Cities",
  "2020_digital_cities_as_infrastructures_for_smart_mobility": "2020 - Digital Cities as Infrastructures for Smart Mobility",
  "2020_digital_transformation_for_urban_resilience": "2020 - Digital Transformation for Urban Resilience",
  "2020_disrupting_finance_with_digital_technologies": "2020 - Disrupting Finance with Digital Technologies",
  "2020_ehealth_personalised_prevention": "2020 - eHealth Personalised Prevention",
  "2020_healthy_lifestyle_and_behavioural_change": "2020 - Healthy Lifestyle and Behavioural Change",
  "2020_internet_of_things_and_business_transformation": "2020 - Internet of Things and Business Transformation",
  "2020_iot_platforms_for_industry_4_0": "2020 - IoT Platforms for Industry 4.0",
  "2020_machine_learning_for_financial_data": "2020 - Machine Learning for Financial Data",
  "2020_ravaging_disruptions_in_retailing": "2020 - Ravaging Disruptions in Retailing",
  "2020_secure_e_governance": "2020 - Secure e-Governance",
  "2020_unleashing_the_power_of_circular_city_data": "2020 - Unleashing the Power of Circular City Data",
  "2021_big_data_for_industry_4_0": "2021 - Big Data for Industry 4.0",
  "2021_data_science_for_financial_problems": "2021 - Data Science for Financial Problems",
  "2021_data_visualisation_and_connectivity_for_healthcare": "2021 - Data, Visualisation and Connectivity for Healthcare",
  "2021_digital_methods_for_media_and_democracy": "2021 - Digital Methods for Media and Democracy",
  "2021_digital_platforms_for_smart_cities": "2021 - Digital Platforms for Smart Cities",
  "2021_digital_transformation_for_organisational_resilience": "2021 - Digital Transformation for Organisational Resilience",
  "2021_disrupting_finance_with_digital_technologies": "2021 - Disrupting Finance with Digital Technologies",
  "2021_e_health_personalised_prevention": "2021 - e-Health: Personalised Prevention",
  "2021_internet_of_things_and_business_transformation": "2021 - Internet of Things and Business Transformation",
  "2021_iot_platforms_for_industry_4_0": "2021 - IoT Platforms for Industry 4.0",
  "2021_reshaping_cities_for_a_healthy_environment": "2021 - Reshaping Cities for a Healthy Environment",
  "2022_bratislava_cyber_security_for_blockchain": "2022 - Bratislava, Cyber Security for Blockchain",
  "2022_budapest_artificial_intelligence_in_financial_services": "2022 - Budapest, Artificial Intelligence in Financial Services",
  "2022_coventry_data_visualisation_and_connectivity_for_healthcare": "2022 - Coventry, Data, Visualisation and Connectivity for Healthcare",
  "2022_helsinki_digital_platforms_for_smart_cities": "2022 - Helsinki, Digital Platforms for Smart Cities",
  "2022_ljubljana_digital_transformation_for_organisational_resilience": "2022 - Ljubljana, Digital Transformation for Organisational Resilience",
  "2022_madrid_disrupting_finance_with_digital_technologies": "2022 - Madrid, Disrupting Finance with Digital Technologies",
  "2022_milan_lake_como_digital_interactive_smart_spaces": "2022 - Milan/Lake Como, Digital Interactive Smart Spaces",
  "2022_munich_iot_platforms_for_industry_4_0": "2022 - Munich, IoT Platforms for Industry 4.0",
  "2022_rennes_solutions_for_healthier_digital_cities": "2022 - Rennes, Solutions for Healthier Digital Cities",
  "2022_tallinn_cyber_security_in_e_governance": "2022 - Tallinn, Cyber Security in e-Governance",
  "2022_tallinn_e_health_personalised_prevention": "2022 - Tallinn, e-Health: Personalised Prevention",
  "2023_helsinki_digital_platforms_for_smart_cities": "2023 - Helsinki, Digital Platforms for Smart Cities",
  "2023_lesvos_cyber_security_between_tech_and_business": "2023 - Lesvos, Cyber Security between Tech and Business",
  "2023_ljubljana_digital_transformation_for_organisational_resilience": "2023 - Ljubljana, Digital Transformation for Organisational Resilience",
  "2023_madrid_ai4green_business_lab": "2023 - Madrid, AI4Green Business Lab",
  "2023_madrid_disrupting_finance_with_digital_technologies": "2023 - Madrid, Disrupting Finance with Digital Technologies",
  "2023_madrid_metaverse_and_digital_asset_management": "2023 - Madrid, Metaverse and Digital Asset Management",
  "2023_milan_innovative_digital_technologies_for_health": "2023 - Milan, Innovative Digital Technologies for Health",
  "2023_milan_iot_and_digital_interactive_smart_spaces": "2023 - Milan, IoT and Digital Interactive Smart Spaces",
  "2023_munich_methods_and_tools_for_resilient_industrial_iot": "2023 - Munich, Methods and Tools for Resilient Industrial IoT",
  "2023_nice_quantum_computing_and_information": "2023 - Nice, Quantum Computing and Information",
  "2023_rennes_unfolding_sustainability_through_innovative_green_digital_solutions": "2023 - Rennes, Unfolding Sustainability through Innovative Green Digital Solutions",
  "2023_tallinn_e_health_personalised_prevention": "2023 - Tallinn, e-Health: Personalised Prevention",
  "2023_tel_aviv_ai_for_healthcare_innovation": "2023 - Tel Aviv, AI for Healthcare Innovation",
  "2023_vilnius_boosting_entrepreneurship_in_digital_wellbeing": "2023 - Vilnius, Boosting Entrepreneurship in Digital Wellbeing",
  "2024_glasgow_the_generative_ai_toolkit_for_start_up_and_scale_up_growth": "2024 - Glasgow, The Generative AI Toolkit for Start-up and Scale-up Growth",
  "2024_helsinki_digital_platforms_for_smart_cities": "2024 - Helsinki, Digital Platforms for Smart Cities",
  "2024_ljubljana_digital_technologies_and_entrepreneurship": "2024 - Ljubljana, Digital Technologies and Entrepreneurship",
  "2024_madrid_fintech_frontier": "2024 - Madrid, FinTech Frontier",
  "2024_madrid_techfin_odyssey": "2024 - Madrid, TechFin Odyssey",
  "2024_milan_ai4sustainability": "2024 - Milan, AI4Sustainability",
  "2024_palermo_deep_tech_entrepreneurship": "2024 - Palermo, Deep Tech Entrepreneurship",
  "2024_rennes_innovative_ventures_for_social_and_environmental_sustainability": "2024 - Rennes, Innovative Ventures for Social and Environmental Sustainability",
  "2024_riga_cyber_security_agile_methodology_for_developing_new_solutions": "2024 - Riga, Cyber Security – Agile Methodology for Developing New Solutions",
  "2024_spin_explore": "2024 - SPIN: Explore",
  "2024_spin_rise": "2024 - SPIN: Rise",
  "2024_syros_maritime_robotics_and_informatics": "2024 - Syros, Maritime Robotics and Informatics",
  "2024_nice_quantum_computing_and_information": "2024 - Nice, Quantum Computing and Information",
  "2025_barcelona_upbeat_summer_school": "2025 - Barcelona, UPBEAT Summer School",
  "2025_cava_de_tirreni_space_tech_and_ai_for_transforming_industry": "2025 - Cava de' Tirreni, Space Tech and AI for Transforming Industry",
  "2025_glasgow_generative_ai_for_start_ups_and_scale_ups": "2025 - Glasgow, Generative AI for Start-ups and Scale-ups",
  "2025_helsinki_digital_platforms_for_smart_cities": "2025 - Helsinki, Digital Platforms for Smart Cities",
  "2025_ljubljana_digital_technologies_and_entrepreneurship": "2025 - Ljubljana, Digital Technologies and Entrepreneurship",
  "2025_madrid_fintech_frontier": "2025 - Madrid, FinTech Frontier",
  "2025_rennes_ai_driven_cyber_security": "2025 - Rennes, AI-driven Cyber Security",
  "2025_syros_island_maritime_informatics_and_robotics": "2025 - Syros Island, Maritime Informatics & Robotics",
};

export interface AffiliationEntry {
  question: string;
  answer: string;
}

export function formatAffiliationResultJson(
  resultJson: Record<string, unknown>,
): AffiliationEntry[] {
  const academicPath = resultJson.academicPath;
  if (!Array.isArray(academicPath) || academicPath.length === 0) return [];

  const entries: AffiliationEntry[] = [];

  for (let i = 0; i < academicPath.length; i++) {
    const panel = academicPath[i] as Record<string, unknown>;
    const prefix = academicPath.length > 1 ? `Period ${i + 1} – ` : "";

    if (panel.affilation) {
      entries.push({
        question: `${prefix}How you know us`,
        answer: AFFILIATION_LABELS[panel.affilation as string] ?? String(panel.affilation),
      });
    }
    if (panel.year) {
      entries.push({ question: "Entry Year", answer: String(panel.year) });
    }
    if (panel.entry_university) {
      entries.push({
        question: "Entry University",
        answer: UNIVERSITY_LABELS[panel.entry_university as string] ?? String(panel.entry_university),
      });
    }
    if (panel.exit_university) {
      entries.push({
        question: "Exit University",
        answer: UNIVERSITY_LABELS[panel.exit_university as string] ?? String(panel.exit_university),
      });
    }
    if (panel.track) {
      entries.push({
        question: "Track",
        answer: TRACK_LABELS[panel.track as string] ?? String(panel.track),
      });
    }
    if (panel.summerSchool) {
      entries.push({
        question: "Summer School",
        answer: SUMMER_SCHOOL_LABELS[panel.summerSchool as string] ?? String(panel.summerSchool),
      });
    }
  }

  return entries;
}
