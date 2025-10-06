# Deep Learning for Patient Outcome Prediction (Profound Hypotension)

**Student:** `Joshua Timothy Gratio Wibowo` — **Student ID:** `1545903`  
**Assignment 2:** Deep Learning for Patient Outcome Prediction with Multi‑Layer Perceptron (MLP)

---

## Problem Description

Profound hypotension in ICU patients carries high mortality risk. The goal of this assignment is to build
and evaluate models that predict **in‑hospital mortality** using tabular features available at/near ICU
admission:

- `anchor_age` (years), `gender` (F/M), `apsiii` (Acute Physiology Score III: severity of illness),
- `charlson_comorbidity_index` (comorbidity burden).

**Target:** derived from `dod` (Date of Death). Any non‑empty `dod` ⇒ `in_hospital_mortality=1`, else 0.  
**Important:** `LoS` (ICU length of stay) is **excluded** from features to avoid post‑discharge data leakage.

---

## Assignemnt 2 Submission Contents

| File | Purpose |
|---|---|
| `MLHealthA2.ipynb` | Single Jupyter notebook containing Step 1 (EDA), Step 2 (linear MLP + tuning), Step 3 (ReLU MLP + comparison). |
| `hypotension_patients.csv` | Input dataset (provided). |
| `environment.yml` | Exact, reproducible conda environment specification. |
| `README.md` | This file with instructions and context. |

---

## Environment Setup (Conda)

```bash
conda env create -f environment.yml
conda activate mlhealth-a2
jupyter lab   # or: jupyter notebook
```

---

## How to Run

1. Place `hypotension_patients.csv` in the same directory as the notebook.  
2. Launch Jupyter and open `MLHealthA2.ipynb`.  
3. Run the notebook **top to bottom**. A cleaned copy `hypotension_patients_clean.csv` will be saved for reuse.  
4. The notebook will output descriptive tables, histograms, grid‑search plots, confusion matrices, and a
   side‑by‑side metric table comparing the linear and ReLU MLPs.

---

## Methods (High‑level Overview)

- **Step 1 (EDA):** summary statistics for numeric features; histograms for distributions; prevalence plots
  for gender and outcome. Cohort summary emphasizes class imbalance and severity profile.  
- **Preprocessing:** numeric ⇒ median imputation + standardization; categorical (`gender`) ⇒ one‑hot; all in an
  sklearn `Pipeline`/`ColumnTransformer` for reproducibility.  
- **Step 2 (Linear MLP):** scikit‑learn `MLPClassifier` with hidden `activation='identity'` (linear network).  
  Grid over **layers** ∈ {1,2,3}, **units** ∈ {16,32,64}, **learning rate** ∈ {1e‑2, 1e‑3, 1e‑4}.  
  **Split:** stratified 70/15/15 (train/val/test). **Selection metric:** validation **F1** (balances precision/recall).  
- **Step 3 (Non‑linear MLP):** same best architecture as Step 2 but with **ReLU** activation; trained on train+val and
  evaluated on the held‑out test set. Metrics: **accuracy, precision, recall, F1**, plus **confusion matrices**.

---

## Reproducibility and Design Choices

- Fixed `random_state=42` for splits and models.  
- All transformations happen **inside the pipeline** to prevent leakage.  
- `LoS` is excluded by design; `dod` is used **only** to derive the label.  
- Primary metric is **F1**, given outcome imbalance and clinical focus on sensitivity while controlling false alarms.

---

## References & Helpful Links

- APS III: [What is APS III](https://en.wikipedia.org/wiki/Autoimmune_polyendocrine_syndrome_type_3)
- CCI: [Charlson Comorbidity Index (CCI)](https://en.wikipedia.org/wiki/Charlson_Comorbidity_Index)

---
