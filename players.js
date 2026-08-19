const playersData = [
// F Tier [50+] //



    { name: "Amelia", 
      overall: 53,

      pace: 60, 
      shooting: 43, 
      passing: 72, 
      dribbling: 40, 
      defence: 30, 
      physical: 31,

      basePrice: 20,
      positions: ["CB", "RB"],
      chemistryWith: ["Niyaaz", "Arya", "Liya"] 
    },

    { name: "Arya", 
      overall: 55,

      pace: 62, 
      shooting: 50, 
      passing: 68, 
      dribbling: 40, 
      defence: 30, 
      physical: 30, 

      basePrice: 30,
      positions: ["CB", "RB"],
      chemistryWith: ["Amelia", "Liya", "Niyaaz"] 
    },

    { name: "Fidel", 
      overall: 60,

      pace: 60, 
      shooting: 60, 
      passing: 50, 
      dribbling: 60, 
      defence: 55, 
      physical: 40, 

      basePrice: 25, 
      positions: ["ST"], 
      chemistryWith: [] 
    },

    { name: "Harvey", 
      overall: 61,

      pace: 60, 
      shooting: 65, 
      passing: 50, 
      dribbling: 61, 
      defence: 65, 
      physical: 40, 

      basePrice: 25, 
      positions: ["CB"], 
      chemistryWith: ["Ethan", "Mason"] 
    },

// D Tier [65+] //



    { name: "Niyaaz", 
      overall: 65,

      pace: 80, 
      shooting: 68, 
      passing: 60, 
      dribbling: 65, 
      defence: 80, 
      physical: 80,

      basePrice: 40, 
      positions: ["CB", "GK"],
      chemistryWith: ["Amelia", "Zaiyaan"] 
    },

    { name: "Murshid", 
      overall: 68,

      pace: 60, 
      shooting: 63, 
      passing: 60, 
      dribbling: 65, 
      defence: 70, 
      physical: 70,

      basePrice: 35, 
      positions: ["ST"],
      chemistryWith: [] 
    },

    { name: "Ismael", 
      overall: 69,

      pace: 50, 
      shooting: 50, 
      passing: 75, 
      dribbling: 50, 
      defence: 70, 
      physical: 90,

      basePrice: 30, 
      positions: ["GK"],
      chemistryWith: [] 
    }, 

// C Tier [70+] // 

    { name: "Yahya", 
      overall: 70,

      pace: 70, 
      shooting: 70, 
      passing: 70, 
      dribbling: 75, 
      defence: 70, 
      physical: 70, 

      basePrice: 30, 
      positions: ["CAM", "RM", "RW"],
      chemistryWith: ["Sulaiman (Bangladesh)", "Yunus"] 
    },

    { name: "Zeshaan", 
      overall: 71,

      pace: 50, 
      shooting: 70, 
      passing: 85, 
      dribbling: 55, 
      defence: 90, 
      physical: 90,

      basePrice: 55, 
      positions: ["CM", "CDM"],
      chemistryWith: ["Irfaan", "Ebrahim"] 
    },

    { name: "Sulaiman (Bangladesh)", 
      overall: 72,

      pace: 79, 
      shooting: 84, 
      passing: 70, 
      dribbling: 79, 
      defence: 75, 
      physical: 70, 

      basePrice: 30, 
      positions: ["GK", "CDM", "RW"],
      chemistryWith: ["Irfaan", "Arya", "Amelia"] 
    },

    { name: "Liya", 
      overall: 73,

      pace: 78, 
      shooting: 83, 
      passing: 81, 
      dribbling: 83, 
      defence: 75, 
      physical: 70, 

      basePrice: 50, 
      positions: ["LWB", "LB", "LM"],
      chemistryWith: ["Irfaan", "Arya", "Amelia"] 
    },

    { name: "Chey", 
      overall: 74,

      pace: 70, 
      shooting: 75, 
      passing: 70, 
      dribbling: 77, 
      defence: 60, 
      physical: 60, 

      basePrice: 30, 
      positions: ["ST", "RW"],
      chemistryWith: ["Benjamin"] 
    },

    // B Tier [80+] //

    { name: "Ryan", 
      overall: 80,

      pace: 75, 
      shooting: 85, 
      passing: 80, 
      dribbling: 75, 
      defence: 67, 
      physical: 77,

      basePrice: 60, 
      positions: ["ST"],
      chemistryWith: ["Qiyam", "Danny"] 
    },

    { name: "Ethan",

      overall: 80, 
      pace: 80, 
      shooting: 70, 
      passing: 65, 
      dribbling: 89, 
      defence: 55, 
      physical: 55, 

      basePrice: 60, 
      positions: ["GK", "LM", "LW"], 
      chemistryWith: ["Qiyam", "Mason"] 
    },

    { name: "Benjamin", 
      overall: 82,

      pace: 77, 
      shooting: 85, 
      passing: 60, 
      dribbling: 90, 
      defence: 70, 
      physical: 70, 

      basePrice: 70, 
      positions: ["CAM", "LW"],
      chemistryWith: ["Sulaiman (Bangladesh)"] 
    },

    { name: "Yunus", 
      overall: 84,

      pace: 80, 
      shooting: 85, 
      passing: 65, 
      dribbling: 88, 
      defence: 75, 
      physical: 60, 

      basePrice: 70, 
      positions: ["LW", "GK"],
      chemistryWith: ["Sulaiman (Bangladesh)", "Yahya"] 
    },

    // A Tier [90+] //



    { name: "Irfaan", 
      overall: 90,

      pace: 77, 
      shooting: 85, 
      passing: 88, 
      dribbling: 84, 
      defence: 70, 
      physical: 80, 

      basePrice: 75, 
      positions: ["CM", "RM"],
      chemistryWith: ["Ebrahim", "Danny", "Zaiyaan", "Qiyam"] 
    },

    { name: "Mason",

      overall: 91,

      pace: 80, 
      shooting: 75, 
      passing: 70, 
      dribbling: 70, 
      defence: 70, 
      physical: 70, 

      basePrice: 75, 
      positions: ["LB", "LM"], 
      chemistryWith: ["Ethan"] 
    },

    { name: "Qiyam", 
      overall: 92,

      pace: 86, 
      shooting: 85, 
      passing: 83, 
      dribbling: 87, 
      defence: 50, 
      physical: 65,

      basePrice: 80, 
      positions: ["LW"],
      chemistryWith: ["Ryan", "Irfaan", "Ebrahim"] 
    },

    { name: "Danny", 
      overall: 93,

      pace: 85, 
      shooting: 84, 
      passing: 85, 
      dribbling: 86, 
      defence: 90, 
      physical: 82,

      basePrice: 90, 
      positions: ["GK", "CB", "CDM"],
      chemistryWith: ["Ebrahim", "Irfaan", "Zaiyaan", "Ryan"] 
    },

    { name: "Sulaiman (Somalia) ", 
      overall: 94,

      pace: 75, 
      shooting: 60, 
      passing: 90, 
      dribbling: 75, 
      defence: 90, 
      physical: 70, 

      basePrice: 80, 
      positions: ["GK"],
      chemistryWith: ["Qiyam"] 
    },

    // S Tier [95+] //



    { name: "Zaiyaan", 
      overall: 95,
      pace: 90, 
      shooting: 92, 
      passing: 86, 
      dribbling: 95, 
      defence: 80, 
      physical: 84, 
      basePrice: 100, 
      positions: ["CM", "CAM", "ST"],
      chemistryWith: ["Ebrahim", "Irfaan", "Danny"] 
    },

    { name: "Ebrahim", 
      overall: 95,
      pace: 88, 
      shooting: 91, 
      passing: 88, 
      dribbling: 95, 
      defence: 86, 
      physical: 84, 
      basePrice: 105, 
      positions: ["CM", "CAM", "CDM", "CB", "GK"],
      chemistryWith: ["Qiyam", "Danny", "Irfaan", "Zaiyaan"] 
    },
];
