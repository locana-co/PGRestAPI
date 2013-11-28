 
/*----------------------------------------
        styling HexBins - - Need to change values based on Country     
  ----------------------------------------*/
 
#uganda_hexbins {
  
  polygon-opacity:0.5;
  [cicoscapit >= 5]{polygon-fill:red;}
  [cicoscapit >= 10]{polygon-fill:yellow;}
  [cicoscapit >= 25]{polygon-fill:green;}
  
  ::outline {
    line-color: white;
    line-width: 1;
    line-join: round;
  }
}