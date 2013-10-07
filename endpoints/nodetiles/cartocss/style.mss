/*@land: lighten(#e5f3e5 ,20%);*/
@land: rgba(0,0,0,0);
@text: #FF1493;
@OrangeRed: #FF4500;

Map {
  background-color: @land;
  /* background-image: "grid.png"; */
}

#world {
  line-color: lighten(yellow, 30%);
  line-width: 2;
  polygon-fill: yellow;
}
#example {
  line-color: lighten(@text,20%);
  line-width: 3;
  polygon-fill: @text;
  text-name: [Description];
  text-placement: line;
  text-size: 16;
  text-halo-fill: lighten(@text,80%);
  text-halo-radius: 2;
  
  [Name="nnn"] {
    polygon-fill: red;

  }
  [Name="ooo"] {
    polygon-fill: blue;
  }
  [Name="ddd"] {
    polygon-fill: #FF00FF;
  }
  [Name="eee"] {
    polygon-fill: brown;
  }
  [Name="ttt"] {
    polygon-fill: #1E90FF;
  }
  [Name="iii"] {
    polygon-fill: @OrangeRed;
  }
  [Name="lll"] {
    polygon-fill: #8B008B;
  }  
  [Name="sss"] {
    polygon-fill: #4B0082;
  }  
}

