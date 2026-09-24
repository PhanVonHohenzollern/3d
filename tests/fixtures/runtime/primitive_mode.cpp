// setPrimitiveMode updates m_primitiveMode and remains in API Trace.
//@eval m_primitiveMode
//@line 999
//@line 6
double before = m_primitiveMode;
setPrimitiveMode(FLM3Geo::pmIntInsulation);
double mid = m_primitiveMode;
setPrimitiveMode(FLM3Geo::primitiveMode::pmExtInsulation);
double mid2 = m_primitiveMode;
setPrimitiveMode(2.7);
setPrimitiveMode(primitiveMode::pmNormal);
setPrimitiveMode(vx);
setPrimitiveMode(unknownMode);
setPrimitiveMode(1, 2);
setPrimitiveMode();
FLM3Geo::primitiveMode saved = FLM3Geo::pmExtInsulation;
setPrimitiveMode(saved);
double after = m_primitiveMode;
