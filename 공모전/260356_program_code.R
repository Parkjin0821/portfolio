# ===============================================================
# 2026 날씨 BIG데이터 콘테스트 분석프로그램 코드
# 주제: 기상데이터 및 전력설비 정보를 활용한 화재위험도 이진분류
#
# 실행 방법
#   1. RStudio에서 작업 폴더를 본 파일이 있는 폴더로 설정
#      setwd("C:/Users/ParkJin/Documents/날씨 공모전 2")
#   2. 실행
#      source("submission_analysis_program_code.R")
#
# 입력 파일
#   data/train_dataset_competition_slim.csv
#   data/model_features_competition_slim.csv
#
# 주요 출력 파일
#   data/sigungu_aggregated.csv
#   data/sigungu_feature_selection.csv
#   data/sigungu_loocv_glm.csv
#   data/sigungu_loocv_tree.csv
#   data/sigungu_model_comparison.csv
#   data/sigungu_final_predictions.csv
#   figures/fig1_feature_importance.png
#   figures/fig2_key_feature_sigungu.png
#   figures/fig3_model_comparison.png
#   figures/fig4_loocv_detail.png
#   figures/fig5_decision_tree.png
# ===============================================================

set.seed(42)
options(stringsAsFactors = FALSE)

# ---------------------------------------------------------------
# 0. 패키지 준비
# ---------------------------------------------------------------
required_packages <- c("data.table", "rpart", "ggplot2")
for (pkg in required_packages) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    install.packages(pkg, repos = "https://cloud.r-project.org")
  }
}

suppressPackageStartupMessages({
  library(data.table)
  library(rpart)
  library(ggplot2)
})

DATA_DIR <- "data"
FIG_DIR <- "figures"
dir.create(DATA_DIR, showWarnings = FALSE)
dir.create(FIG_DIR, showWarnings = FALSE)

TRAIN_PATH <- file.path(DATA_DIR, "train_dataset_competition_slim.csv")
FEATURES_PATH <- file.path(DATA_DIR, "model_features_competition_slim.csv")

OUT_AGG <- file.path(DATA_DIR, "sigungu_aggregated.csv")
OUT_FEATSEL <- file.path(DATA_DIR, "sigungu_feature_selection.csv")
OUT_LOOCV_GLM <- file.path(DATA_DIR, "sigungu_loocv_glm.csv")
OUT_LOOCV_TREE <- file.path(DATA_DIR, "sigungu_loocv_tree.csv")
OUT_COMPARE <- file.path(DATA_DIR, "sigungu_model_comparison.csv")
OUT_PRED <- file.path(DATA_DIR, "sigungu_final_predictions.csv")

if (!file.exists(TRAIN_PATH)) stop("학습 데이터가 없습니다: ", TRAIN_PATH)
if (!file.exists(FEATURES_PATH)) stop("전체 예측 데이터가 없습니다: ", FEATURES_PATH)


# ---------------------------------------------------------------
# 1. 평가 함수
# ---------------------------------------------------------------
compute_auc <- function(label, prob) {
  ok <- !is.na(label) & !is.na(prob)
  label <- label[ok]
  prob <- prob[ok]
  pos <- prob[label == 1]
  neg <- prob[label == 0]
  if (length(pos) == 0 || length(neg) == 0) return(NA_real_)
  sum(outer(pos, neg, ">") + 0.5 * outer(pos, neg, "==")) /
    (length(pos) * length(neg))
}

calc_metrics <- function(label, pred_label, pred_prob) {
  tp <- sum(label == 1 & pred_label == 1, na.rm = TRUE)
  tn <- sum(label == 0 & pred_label == 0, na.rm = TRUE)
  fp <- sum(label == 0 & pred_label == 1, na.rm = TRUE)
  fn <- sum(label == 1 & pred_label == 0, na.rm = TRUE)

  accuracy <- (tp + tn) / max(tp + tn + fp + fn, 1)
  precision <- ifelse(tp + fp == 0, NA_real_, tp / (tp + fp))
  recall <- ifelse(tp + fn == 0, NA_real_, tp / (tp + fn))
  f1 <- ifelse(
    is.na(precision) || is.na(recall) || precision + recall == 0,
    NA_real_,
    2 * precision * recall / (precision + recall)
  )
  auc <- compute_auc(label, pred_prob)

  data.table(
    tp = tp,
    tn = tn,
    fp = fp,
    fn = fn,
    accuracy = round(accuracy, 4),
    precision = round(precision, 4),
    recall = round(recall, 4),
    f1 = round(f1, 4),
    auc = round(auc, 4)
  )
}

scale_train <- function(dt, cols) {
  out <- copy(dt)
  params <- list()
  for (col in cols) {
    mu <- mean(out[[col]], na.rm = TRUE)
    sig <- sd(out[[col]], na.rm = TRUE)
    if (is.na(sig) || sig == 0) sig <- 1
    out[, (col) := (get(col) - mu) / sig]
    params[[col]] <- c(mu = mu, sig = sig)
  }
  list(data = out, params = params)
}

scale_apply <- function(dt, params) {
  out <- copy(dt)
  for (col in names(params)) {
    if (col %in% names(out)) {
      mu <- params[[col]][["mu"]]
      sig <- params[[col]][["sig"]]
      out[, (col) := (get(col) - mu) / sig]
    }
  }
  out
}


# ---------------------------------------------------------------
# 2. 데이터 로드 및 시군구 단위 집계
# ---------------------------------------------------------------
cat("\n[1] 학습 데이터 로드\n")
train_dt <- fread(TRAIN_PATH, encoding = "UTF-8")
train_dt[, label := as.integer(label)]

cat("전신주 행 수:", nrow(train_dt), "\n")
cat("시군구 수:", uniqueN(train_dt$sigungu), "\n")
print(train_dt[, .N, by = label][order(label)])

# 동일 시군구 전신주는 같은 라벨을 갖기 때문에 전신주 단위 분할을 쓰지 않고
# 시군구 단위로 평균 피처를 만든다.
exclude_cols <- c(
  "pole_id", "lon", "lat", "label", "sigungu", "geometry",
  "street_view_url", "label_sigungu_high_elec_fire"
)
numeric_cols <- setdiff(names(train_dt), exclude_cols)
numeric_cols <- numeric_cols[vapply(train_dt[, ..numeric_cols], is.numeric, logical(1))]
numeric_cols <- numeric_cols[
  !vapply(train_dt[, ..numeric_cols], function(x) all(is.na(x)), logical(1))
]

sgg_dt <- train_dt[
  ,
  c(
    list(label = first(label)),
    lapply(.SD, function(x) mean(x, na.rm = TRUE))
  ),
  by = sigungu,
  .SDcols = numeric_cols
]

fwrite(sgg_dt, OUT_AGG)
cat("시군구 집계 저장:", OUT_AGG, "\n")


# ---------------------------------------------------------------
# 3. Wilcoxon 검정 기반 피처 선택
# ---------------------------------------------------------------
cat("\n[2] 피처 유의성 검정\n")
feature_selection <- rbindlist(lapply(numeric_cols, function(col) {
  x_risk <- sgg_dt[label == 1, get(col)]
  x_safe <- sgg_dt[label == 0, get(col)]

  if (sum(!is.na(x_risk)) < 2 || sum(!is.na(x_safe)) < 2) {
    return(data.table(
      feature = col,
      p_value = NA_real_,
      mean_risk = mean(x_risk, na.rm = TRUE),
      mean_safe = mean(x_safe, na.rm = TRUE),
      diff = NA_real_
    ))
  }

  p <- tryCatch(
    wilcox.test(x_risk, x_safe, exact = FALSE)$p.value,
    error = function(e) NA_real_
  )

  data.table(
    feature = col,
    p_value = round(p, 4),
    mean_risk = round(mean(x_risk, na.rm = TRUE), 4),
    mean_safe = round(mean(x_safe, na.rm = TRUE), 4),
    diff = round(mean(x_risk, na.rm = TRUE) - mean(x_safe, na.rm = TRUE), 4)
  )
}))

feature_selection <- feature_selection[order(p_value)]
fwrite(feature_selection, OUT_FEATSEL)
print(head(feature_selection, 10))

# 표본 수가 16개로 작으므로 GLM에는 상위 3개 피처만 사용한다.
MAX_GLM_FEATURES <- 3
top_features <- feature_selection[!is.na(p_value)][
  seq_len(min(MAX_GLM_FEATURES, .N))
]$feature
cat("GLM 사용 피처:", paste(top_features, collapse = ", "), "\n")


# ---------------------------------------------------------------
# 4. LOOCV: GLM
# ---------------------------------------------------------------
cat("\n[3] LOOCV - 로지스틱 회귀(GLM)\n")
n <- nrow(sgg_dt)
glm_results <- vector("list", n)

for (i in seq_len(n)) {
  train_fold <- sgg_dt[-i]
  test_fold <- sgg_dt[i]

  scaled <- scale_train(train_fold, top_features)
  train_scaled <- scaled$data
  test_scaled <- scale_apply(test_fold, scaled$params)

  glm_formula <- as.formula(paste("label ~", paste(top_features, collapse = " + ")))
  fit <- tryCatch(
    suppressWarnings(glm(glm_formula, data = train_scaled, family = binomial())),
    error = function(e) NULL
  )

  prob <- if (is.null(fit)) {
    NA_real_
  } else {
    tryCatch(predict(fit, newdata = test_scaled, type = "response"), error = function(e) NA_real_)
  }

  glm_results[[i]] <- data.table(
    sigungu = test_fold$sigungu,
    label = test_fold$label,
    pred_prob = round(prob, 4),
    pred_label = as.integer(!is.na(prob) & prob >= 0.5)
  )
}

loocv_glm <- rbindlist(glm_results)
fwrite(loocv_glm, OUT_LOOCV_GLM)
glm_metrics <- calc_metrics(loocv_glm$label, loocv_glm$pred_label, loocv_glm$pred_prob)
print(glm_metrics)


# ---------------------------------------------------------------
# 5. LOOCV: 의사결정트리
# ---------------------------------------------------------------
cat("\n[4] LOOCV - 의사결정트리(rpart)\n")
tree_results <- vector("list", n)
tree_formula <- as.formula(paste("factor(label) ~", paste(numeric_cols, collapse = " + ")))

for (i in seq_len(n)) {
  train_fold <- sgg_dt[-i]
  test_fold <- sgg_dt[i]

  fit <- tryCatch(
    rpart(
      tree_formula,
      data = train_fold,
      method = "class",
      control = rpart.control(cp = 0.1, minsplit = 4, minbucket = 2)
    ),
    error = function(e) NULL
  )

  prob <- if (is.null(fit)) {
    NA_real_
  } else {
    pred_mat <- tryCatch(predict(fit, newdata = test_fold, type = "prob"), error = function(e) NULL)
    if (is.null(pred_mat) || !("1" %in% colnames(pred_mat))) NA_real_ else pred_mat[, "1"]
  }

  tree_results[[i]] <- data.table(
    sigungu = test_fold$sigungu,
    label = test_fold$label,
    pred_prob = round(prob, 4),
    pred_label = as.integer(!is.na(prob) & prob >= 0.5)
  )
}

loocv_tree <- rbindlist(tree_results)
fwrite(loocv_tree, OUT_LOOCV_TREE)
tree_metrics <- calc_metrics(loocv_tree$label, loocv_tree$pred_label, loocv_tree$pred_prob)
print(tree_metrics)


# ---------------------------------------------------------------
# 6. 모델 비교 및 최종 모델 선택
# ---------------------------------------------------------------
cat("\n[5] 모델 비교\n")
comparison <- rbindlist(list(
  data.table(model = "GLM", glm_metrics),
  data.table(model = "rpart", tree_metrics)
))
fwrite(comparison, OUT_COMPARE)
print(comparison)

best_model <- comparison[which.max(f1)]$model
cat("최종 선택 모델:", best_model, "\n")


# ---------------------------------------------------------------
# 7. 전체 시군구로 최종 모델 학습
# ---------------------------------------------------------------
cat("\n[6] 최종 모델 학습\n")

if (best_model == "GLM") {
  scaled_final <- scale_train(sgg_dt, top_features)
  final_train <- scaled_final$data
  final_model <- suppressWarnings(
    glm(glm_formula, data = final_train, family = binomial())
  )
  final_input <- scale_apply(sgg_dt, scaled_final$params)
  sgg_dt[, final_prob := predict(final_model, newdata = final_input, type = "response")]
} else {
  final_model <- rpart(
    tree_formula,
    data = sgg_dt,
    method = "class",
    control = rpart.control(cp = 0.1, minsplit = 4, minbucket = 2)
  )
  pred_mat <- predict(final_model, newdata = sgg_dt, type = "prob")
  sgg_dt[, final_prob := if ("1" %in% colnames(pred_mat)) pred_mat[, "1"] else 0.5]
  print(final_model)
}

sgg_pred <- sgg_dt[
  ,
  .(
    sigungu,
    label,
    final_prob = round(final_prob, 4),
    final_pred = as.integer(final_prob >= 0.5)
  )
][order(-final_prob)]
print(sgg_pred)


# ---------------------------------------------------------------
# 8. 전체 전신주 예측 결과 생성
# ---------------------------------------------------------------
cat("\n[7] 전체 전신주 예측 결과 생성\n")
all_features <- fread(FEATURES_PATH, encoding = "UTF-8")

prediction <- merge(
  all_features[, .(pole_id, lon, lat, sigungu)],
  sgg_dt[, .(sigungu, fire_risk_prob = final_prob)],
  by = "sigungu",
  all.x = TRUE
)

prediction[, fire_risk_label_05 := as.integer(fire_risk_prob >= 0.5)]
prediction <- prediction[
  order(pole_id),
  .(pole_id, lon, lat, sigungu, fire_risk_prob, fire_risk_label_05)
]

fwrite(prediction, OUT_PRED)
cat("최종 예측 저장:", OUT_PRED, "\n")
print(prediction[, .N, by = fire_risk_label_05][order(fire_risk_label_05)])


# ---------------------------------------------------------------
# 9. 제출 보고서용 그림 생성
# ---------------------------------------------------------------
cat("\n[8] 그림 생성\n")

# 그림 1: 피처 유의성
plot_feat <- copy(feature_selection[!is.na(p_value)])
plot_feat <- plot_feat[order(p_value)][1:min(12, .N)]
plot_feat[, significant := p_value < 0.05]

p1 <- ggplot(plot_feat, aes(x = reorder(feature, -log10(p_value)), y = -log10(p_value), fill = significant)) +
  geom_col(width = 0.7) +
  coord_flip() +
  geom_hline(yintercept = -log10(0.05), linetype = "dashed", color = "#C44E52") +
  scale_fill_manual(values = c("FALSE" = "#B0B7C3", "TRUE" = "#2E75B6"), guide = "none") +
  labs(x = NULL, y = "-log10(p-value)", title = "피처 유의성 검정 결과") +
  theme_minimal(base_family = "sans")
ggsave(file.path(FIG_DIR, "fig1_feature_importance.png"), p1, width = 8, height = 5, dpi = 150)

# 그림 2: 시군구별 핵심 변수
key_feature <- "fire_elec_mech_per_10k_poles"
p2 <- ggplot(sgg_dt, aes(x = reorder(sigungu, get(key_feature)), y = get(key_feature), fill = factor(label))) +
  geom_col(width = 0.7) +
  coord_flip() +
  geom_hline(yintercept = 7.61, linetype = "dashed", color = "#C44E52") +
  scale_fill_manual(values = c("0" = "#A6CEE3", "1" = "#E66101"), labels = c("안전", "위험"), name = "라벨") +
  labs(x = NULL, y = "10만 전신주당 전기·기계 산불 발생 건수", title = "시군구별 핵심 피처 비교") +
  theme_minimal(base_family = "sans")
ggsave(file.path(FIG_DIR, "fig2_key_feature_sigungu.png"), p2, width = 8, height = 5, dpi = 150)

# 그림 3: 모델 성능 비교
metric_cols <- c("accuracy", "precision", "recall", "f1", "auc")
comparison_long <- melt(
  comparison,
  id.vars = "model",
  measure.vars = metric_cols,
  variable.name = "metric",
  value.name = "score"
)
p3 <- ggplot(comparison_long, aes(x = metric, y = score, fill = model)) +
  geom_col(position = "dodge", width = 0.7) +
  scale_y_continuous(limits = c(0, 1), expand = expansion(mult = c(0, 0.05))) +
  scale_fill_manual(values = c("GLM" = "#9ECAE1", "rpart" = "#1F4E79")) +
  labs(x = NULL, y = "Score", title = "GLM vs 의사결정트리 성능 비교") +
  theme_minimal(base_family = "sans")
ggsave(file.path(FIG_DIR, "fig3_model_comparison.png"), p3, width = 8, height = 5, dpi = 150)

# 그림 4: LOOCV 상세 결과
p4 <- ggplot(loocv_tree, aes(x = reorder(sigungu, pred_prob), y = pred_prob, color = factor(label))) +
  geom_point(size = 3) +
  geom_hline(yintercept = 0.5, linetype = "dashed", color = "#C44E52") +
  coord_flip() +
  scale_color_manual(values = c("0" = "#4C78A8", "1" = "#E45756"), labels = c("안전", "위험"), name = "실제 라벨") +
  labs(x = NULL, y = "위험 예측 확률", title = "LOOCV 시군구별 예측 결과") +
  theme_minimal(base_family = "sans")
ggsave(file.path(FIG_DIR, "fig4_loocv_detail.png"), p4, width = 8, height = 5, dpi = 150)

# 그림 5: 의사결정트리 구조를 간단한 텍스트 그림으로 저장
tree_text <- data.table(
  x = c(1, 1, 1),
  y = c(3, 2, 1),
  label = c(
    "fire_elec_mech_per_10k_poles < 7.61",
    "TRUE  -> 안전(safe)",
    "FALSE -> 위험(risk)"
  )
)
p5 <- ggplot(tree_text, aes(x = x, y = y, label = label)) +
  geom_label(fill = "#F2F2F2", color = "#1F4E79", size = 5, label.size = 0.4) +
  xlim(0.2, 1.8) +
  ylim(0.5, 3.5) +
  labs(title = "의사결정트리 구조") +
  theme_void(base_family = "sans") +
  theme(plot.title = element_text(hjust = 0.5, face = "bold"))
ggsave(file.path(FIG_DIR, "fig5_decision_tree.png"), p5, width = 8, height = 4, dpi = 150)


# ---------------------------------------------------------------
# 10. 완료 메시지
# ---------------------------------------------------------------
cat("\n분석 완료\n")
cat("최종 결과 파일:", OUT_PRED, "\n")
cat("보고서용 그림 폴더:", FIG_DIR, "\n")
