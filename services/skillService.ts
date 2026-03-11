
// Flatfile-based skill management
export interface Skill {
  id: string;
  name: string;
  description: string;
  code: string;
}

class SkillService {
  private skills: Skill[] = [];

  constructor() {
    this.loadFromFlatfile();
  }

  private loadFromFlatfile() {
    const saved = localStorage.getItem('quanta_skills_flatfile');
    if (saved) this.skills = JSON.parse(saved);
  }

  private saveToFlatfile() {
    localStorage.setItem('quanta_skills_flatfile', JSON.stringify(this.skills));
  }

  addSkill(name: string, description: string, code: string) {
    const skill: Skill = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description,
      code
    };
    this.skills.push(skill);
    this.saveToFlatfile();
    return skill;
  }

  getSkills() {
    return this.skills;
  }
}

export const skillService = new SkillService();
